import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from './lib/firebase-admin.js';

async function publishDue(postId: string) {
  // Keep the cron handler small. It calls the same public server endpoint so the
  // Instagram publishing logic stays in one place.
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error('APP_BASE_URL is required for cron publishing.');

  const response = await fetch(`${base}/api/publish-instagram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
    },
    body: JSON.stringify({ postId })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Publish returned ${response.status}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = Timestamp.now();
    const db = getDb();
    const query = db.collection('social_posts')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .limit(5);

    const snap = await query.get();
    const results: any[] = [];

    for (const doc of snap.docs) {
      try {
        await doc.ref.update({
          status: 'publishing',
          updatedAt: FieldValue.serverTimestamp()
        });
        await publishDue(doc.id);
        results.push({ id: doc.id, ok: true });
      } catch (error: any) {
        await doc.ref.update({
          status: 'failed',
          error: error?.message ?? 'Cron publish failed',
          retryCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
        results.push({ id: doc.id, ok: false, error: error?.message });
      }
    }

    return res.status(200).json({ processed: results.length, results });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error?.message ?? 'Cron failed.' });
  }
}