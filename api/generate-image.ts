import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db, bucket } from './lib/firebase-admin';
import { openai } from './lib/openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const postId = String(req.body?.postId ?? '');
    if (!postId) return res.status(400).json({ error: 'postId is required.' });

    const ref = db.collection('social_posts').doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Post not found.' });

    const data = snap.data()!;
    await ref.update({ status: 'generating', updatedAt: FieldValue.serverTimestamp() });

    const result = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini',
      prompt: `${data.imagePrompt}\nBrand: AccountancyApp. Use the uploaded brand logo only if available to the image workflow; otherwise leave a clean corner for logo placement.`,
      size: '1024x1024',
      quality: 'medium'
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error('Image generation returned no image data.');

    const buffer = Buffer.from(base64, 'base64');
    const filePath = `instagram/${postId}.png`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: 'image/png', cacheControl: 'public,max-age=31536000' },
      resumable: false
    });

    const downloadToken = crypto.randomUUID();
    await file.setMetadata({
      metadata: {
        firebaseStorageDownloadTokens: downloadToken
      }
    });

    const encodedPath = encodeURIComponent(filePath);
    const imageUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    await ref.update({
      imageUrl,
      status: 'ready',
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ imageUrl });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error?.message ?? 'Image generation failed.' });
  }
}