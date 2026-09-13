import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebase-admin';
import { required } from './lib/env';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const postId = String(req.body?.postId ?? '');
    if (!postId) return res.status(400).json({ error: 'postId is required.' });

    const ref = db.collection('social_posts').doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Post not found.' });

    const post = snap.data()!;
    if (!post.imageUrl) return res.status(400).json({ error: 'Generate the image before publishing.' });

    const accessToken = required('INSTAGRAM_ACCESS_TOKEN');
    const igUserId = required('INSTAGRAM_BUSINESS_ACCOUNT_ID');
    const version = process.env.META_GRAPH_VERSION || 'v24.0';

    const caption = [post.caption, ...(post.hashtags ?? [])].join('\n\n');

    const createUrl = `https://graph.facebook.com/${version}/${igUserId}/media`;
    const createParams = new URLSearchParams({
      image_url: post.imageUrl,
      caption,
      access_token: accessToken
    });

    await ref.update({ status: 'publishing', updatedAt: FieldValue.serverTimestamp() });

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createParams
    });
    const container = await createResponse.json();

    if (!createResponse.ok || !container.id) {
      throw new Error(container?.error?.message || 'Instagram media container creation failed.');
    }

    const publishUrl = `https://graph.facebook.com/${version}/${igUserId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: container.id,
      access_token: accessToken
    });

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams
    });
    const published = await publishResponse.json();

    if (!publishResponse.ok || !published.id) {
      throw new Error(published?.error?.message || 'Instagram publish failed.');
    }

    await ref.update({
      status: 'published',
      instagramMediaId: published.id,
      publishedAt: FieldValue.serverTimestamp(),
      error: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ ok: true, instagramMediaId: published.id });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error?.message ?? 'Instagram publishing failed.' });
  }
}