import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getStorage } from './lib/firebase-admin.js';
import { openai } from './lib/openai.js';
import sharp from 'sharp';
import path from 'path';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const postId = String(req.body?.postId ?? '').trim();

    if (!postId) {
      return res.status(400).json({ error: 'postId is required.' });
    }

    // Get post from Firestore
    const db = getDb();
    const postRef = db.collection('social_posts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = postSnap.data();

    if (!post?.imagePrompt) {
      return res.status(400).json({
        error: 'This post does not have an image prompt.'
      });
    }

    // Generate image with OpenAI
    const result = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini',
      prompt: post.imagePrompt,
      size: '1024x1024'
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error('OpenAI did not return an image.');
    }

    /// Convert Base64 → Buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // --------------------------------------------------
    // Add official logo to generated image
    // --------------------------------------------------

    const logoPath = path.join(
      process.cwd(),
      'public',
      'logo.png'
    );

    // Resize logo
    const logoBuffer = await sharp(logoPath)
      .resize({
        width: 120,
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Add logo to bottom-right
    const brandedImage = await sharp(imageBuffer)
      .composite([
        {
          input: logoBuffer,
          gravity: 'southeast'
        }
      ])
      .png()
      .toBuffer();

    // --------------------------------------------------
    // Upload branded image to Firebase Storage
    // --------------------------------------------------

    const filePath = `social-posts/${postId}.png`;

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

    if (!bucketName) {
      throw new Error('FIREBASE_STORAGE_BUCKET is missing at runtime.');
    }

    const storage = getStorage();
    const bucket = storage.bucket(bucketName);

    const file = bucket.file(filePath);

    await file.save(brandedImage, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          postId,
          generatedBy: 'openai',
          branded: 'true'
        }
      }
    });

    // Make the file publicly accessible
    await file.makePublic();

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Update Firestore
    await postRef.update({
      imageUrl,
      status: 'ready',
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      imageUrl
    });

  } catch (error: any) {
    console.error('Image generation error:', error);

    return res.status(500).json({
      error: error?.message ?? 'Image generation failed.'
    });
  }
}