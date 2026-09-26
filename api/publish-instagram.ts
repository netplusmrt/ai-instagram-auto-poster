import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './lib/firebase-admin.js';
import { required } from './lib/env.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  let postRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const postId = String(req.body?.postId ?? '').trim();

    if (!postId) {
      return res.status(400).json({
        error: 'postId is required.'
      });
    }

    const db = getDb();

    postRef = db
      .collection('social_posts')
      .doc(postId);

    const snap = await postRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        error: 'Post not found.'
      });
    }

    const post = snap.data()!;

    // --------------------------------------------------
    // Already published protection
    // --------------------------------------------------

    if (post.status === 'published') {
      return res.status(200).json({
        ok: true,
        alreadyPublished: true,
        instagramMediaId: post.instagramMediaId ?? null
      });
    }

    // --------------------------------------------------
    // Validate post status
    // --------------------------------------------------

    const allowedStatuses = [
      'scheduled',
      'publishing'
    ];

    if (!allowedStatuses.includes(post.status)) {
      return res.status(400).json({
        error: `Post cannot be published from status: ${post.status}`
      });
    }

    // --------------------------------------------------
    // Validate image
    // --------------------------------------------------

    if (!post.imageUrl) {
      await postRef.update({
        status: 'failed',
        error: 'Generate the image before publishing.',
        retryCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });

      return res.status(400).json({
        error: 'Generate the image before publishing.'
      });
    }

    // --------------------------------------------------
    // Retry protection
    // --------------------------------------------------

    const retryCount =
      Number(post.retryCount ?? 0);

    const MAX_RETRIES = 3;

    if (retryCount >= MAX_RETRIES) {
      await postRef.update({
        status: 'failed',
        error: `Maximum retry limit (${MAX_RETRIES}) reached.`,
        updatedAt: FieldValue.serverTimestamp()
      });

      return res.status(400).json({
        error: `Maximum retry limit (${MAX_RETRIES}) reached.`
      });
    }

    // --------------------------------------------------
    // Environment
    // --------------------------------------------------

    const accessToken =
      required('INSTAGRAM_ACCESS_TOKEN');

    const igUserId =
      required('INSTAGRAM_BUSINESS_ACCOUNT_ID');

    const version =
      process.env.META_GRAPH_VERSION || 'v24.0';

    // --------------------------------------------------
    // Caption
    // --------------------------------------------------

    const hashtags =
      Array.isArray(post.hashtags)
        ? post.hashtags
        : [];

    const captionParts = [
      post.caption,
      ...hashtags
    ].filter(Boolean);

    const caption =
      captionParts.join('\n\n');

    // --------------------------------------------------
    // Mark as publishing
    // --------------------------------------------------

    await postRef.update({
      status: 'publishing',
      error: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    // --------------------------------------------------
    // STEP 1
    // Create Instagram media container
    // --------------------------------------------------

    const createUrl =
      `https://graph.facebook.com/${version}/${igUserId}/media`;

    const createParams =
      new URLSearchParams({
        image_url: post.imageUrl,
        caption,
        access_token: accessToken
      });

    const createResponse =
      await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },
        body: createParams
      });

    const container =
      await createResponse.json();

    if (
      !createResponse.ok ||
      !container.id
    ) {
      const message =
        container?.error?.message ||
        'Instagram media container creation failed.';

      throw new Error(message);
    }

    const containerId =
      container.id;

    // --------------------------------------------------
    // STEP 2
    // Publish Instagram media container
    // --------------------------------------------------

    const publishUrl =
      `https://graph.facebook.com/${version}/${igUserId}/media_publish`;

    const publishParams =
      new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken
      });

    const publishResponse =
      await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },
        body: publishParams
      });

    const published =
      await publishResponse.json();

    if (
      !publishResponse.ok ||
      !published.id
    ) {
      const message =
        published?.error?.message ||
        'Instagram publish failed.';

      throw new Error(message);
    }

    const instagramMediaId =
      published.id;

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    await postRef.update({
      status: 'published',

      instagramMediaId,

      publishedAt:
        FieldValue.serverTimestamp(),

      error: null,

      updatedAt:
        FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      ok: true,
      alreadyPublished: false,
      instagramMediaId
    });

  } catch (error: any) {

    console.error(
      'Instagram publishing error:',
      error
    );

    // --------------------------------------------------
    // FAILURE
    // --------------------------------------------------

    if (postRef) {
      try {
        await postRef.update({
          status: 'failed',

          error:
            error?.message ??
            'Instagram publishing failed.',

          updatedAt:
            FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.error(
          'Failed to update Firestore after publishing error:',
          updateError
        );
      }
    }

    return res.status(500).json({
      error:
        error?.message ??
        'Instagram publishing failed.'
    });
  }
}