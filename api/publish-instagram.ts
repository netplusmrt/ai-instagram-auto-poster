import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './lib/firebase-admin.js';
import { required } from './lib/env.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('PUBLISH INSTAGRAM - IMAGE URL FLOW V2');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const postId = String(req.body?.postId ?? '');

    if (!postId) {
      return res.status(400).json({
        error: 'postId is required.'
      });
    }

    const db = getDb();
    const ref = db.collection('social_posts').doc(postId);

    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        error: 'Post not found.'
      });
    }

    const post = snap.data()!;

    console.log('Post found:', {
      postId,
      hasImageUrl: !!post.imageUrl,
      status: post.status
    });

    if (!post.imageUrl) {
      return res.status(400).json({
        error: 'Generate the image before publishing.'
      });
    }

    const accessToken = required('INSTAGRAM_ACCESS_TOKEN');
    const igUserId = required('INSTAGRAM_BUSINESS_ACCOUNT_ID');
    const version = process.env.META_GRAPH_VERSION || 'v24.0';

    const caption = [
      post.caption ?? '',
      ...(post.hashtags ?? [])
    ]
      .filter(Boolean)
      .join('\n\n');

    console.log('Creating Instagram media container...');

    const createUrl =
      `https://graph.facebook.com/${version}/${igUserId}/media`;

    const createParams = new URLSearchParams({
      image_url: post.imageUrl,
      caption,
      access_token: accessToken
    });

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: createParams
    });

    const createBody = await createResponse.text();

    let container: any;

    try {
      container = JSON.parse(createBody);
    } catch {
      throw new Error(
        `Invalid Instagram create response: ${createBody}`
      );
    }

    if (!createResponse.ok || !container.id) {
      throw new Error(
        container?.error?.message ||
        `Instagram media container creation failed. HTTP ${createResponse.status}`
      );
    }

    const creationId = container.id;

    console.log('Instagram creation ID received:', creationId);

    /*
     * Instagram may need a short amount of time to finish
     * processing the media container before media_publish.
     */
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Publishing Instagram media container...');

    const publishUrl =
      `https://graph.facebook.com/${version}/${igUserId}/media_publish`;

    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken
    });

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: publishParams
    });

    const publishBody = await publishResponse.text();

    let published: any;

    try {
      published = JSON.parse(publishBody);
    } catch {
      throw new Error(
        `Invalid Instagram publish response: ${publishBody}`
      );
    }

    if (!publishResponse.ok || !published.id) {
      throw new Error(
        published?.error?.message ||
        `Instagram publish failed. HTTP ${publishResponse.status}`
      );
    }

    await ref.update({
      status: 'published',
      instagramMediaId: published.id,
      publishedAt: FieldValue.serverTimestamp(),
      error: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(
      'Instagram publishing successful:',
      published.id
    );

    return res.status(200).json({
      ok: true,
      instagramMediaId: published.id
    });

  } catch (error: any) {

    console.error(
      'Instagram publishing error:',
      error
    );

    return res.status(500).json({
      error: error?.message ??
        'Instagram publishing failed.'
    });
  }
}