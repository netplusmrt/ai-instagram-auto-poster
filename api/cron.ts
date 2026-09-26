import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from './lib/firebase-admin.js';

const MAX_RETRIES = 3;
const BATCH_LIMIT = 5;

async function publishDue(postId: string) {
  const base = process.env.APP_BASE_URL;

  if (!base) {
    throw new Error(
      'APP_BASE_URL is required for cron publishing.'
    );
  }

  const response = await fetch(
    `${base}/api/publish-instagram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization':
          `Bearer ${process.env.CRON_SECRET || ''}`
      },
      body: JSON.stringify({
        postId
      })
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      body ||
      `Publish returned ${response.status}`
    );
  }

  return body;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // --------------------------------------------------
  // Allow GET and POST
  // --------------------------------------------------

  if (
    req.method !== 'GET' &&
    req.method !== 'POST'
  ) {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  // --------------------------------------------------
  // Cron authentication
  // --------------------------------------------------

  const secret = process.env.CRON_SECRET;

  if (
    secret &&
    req.headers.authorization !==
      `Bearer ${secret}`
  ) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  try {
    const db = getDb();
    const now = Timestamp.now();

    // --------------------------------------------------
    // Find due scheduled posts
    // --------------------------------------------------

    const snap = await db
      .collection('social_posts')
      .where(
        'status',
        '==',
        'scheduled'
      )
      .where(
        'scheduledAt',
        '<=',
        now
      )
      .limit(BATCH_LIMIT)
      .get();

    const results: any[] = [];

    // --------------------------------------------------
    // Process each post independently
    // --------------------------------------------------

    for (const doc of snap.docs) {
      const postRef = doc.ref;

      try {
        // ----------------------------------------------
        // Atomically claim the post
        // ----------------------------------------------

        const claimed =
          await db.runTransaction(
            async transaction => {
              const currentSnap =
                await transaction.get(postRef);

              if (!currentSnap.exists) {
                return false;
              }

              const currentPost =
                currentSnap.data()!;

              // Another Cron execution may have
              // already claimed or processed it.
              if (
                currentPost.status !==
                'scheduled'
              ) {
                return false;
              }

              const retryCount =
                Number(
                  currentPost.retryCount ?? 0
                );

              // Do not process posts that have
              // already exhausted their retries.
              if (
                retryCount >= MAX_RETRIES
              ) {
                transaction.update(
                  postRef,
                  {
                    status: 'failed',

                    error:
                      `Maximum retry limit (${MAX_RETRIES}) reached.`,

                    updatedAt:
                      FieldValue.serverTimestamp()
                  }
                );

                return false;
              }

              // Claim the post.
              transaction.update(
                postRef,
                {
                  status: 'publishing',

                  updatedAt:
                    FieldValue.serverTimestamp()
                }
              );

              return true;
            }
          );

        // ----------------------------------------------
        // Another Cron execution already claimed it
        // ----------------------------------------------

        if (!claimed) {
          results.push({
            id: doc.id,
            ok: true,
            skipped: true,
            reason:
              'Post was already processed or claimed.'
          });

          continue;
        }

        // ----------------------------------------------
        // Publish to Instagram
        // ----------------------------------------------

        const response =
          await publishDue(doc.id);

        results.push({
          id: doc.id,
          ok: true,
          status: 'published',
          response
        });

      } catch (error: any) {
        console.error(
          `Cron publishing failed for ${doc.id}:`,
          error
        );

        // ----------------------------------------------
        // Read the current document.
        //
        // publish-instagram.ts already increments
        // retryCount when publishing fails.
        // ----------------------------------------------

        let retryCount = 0;
        let currentStatus = 'failed';

        try {
          const failedSnap =
            await postRef.get();

          if (failedSnap.exists) {
            const failedPost =
              failedSnap.data()!;

            retryCount =
              Number(
                failedPost.retryCount ?? 0
              );

            currentStatus =
              String(
                failedPost.status ?? 'failed'
              );
          }
        } catch (
          readError
        ) {
          console.error(
            'Unable to read failed post:',
            readError
          );
        }

        // ----------------------------------------------
        // If publishing endpoint already marked it
        // failed, decide whether another attempt is
        // allowed.
        // ----------------------------------------------

        if (
          retryCount >= MAX_RETRIES
        ) {
          await postRef.update({
            status: 'failed',

            error:
              error?.message ??
              'Maximum retry limit reached.',

            updatedAt:
              FieldValue.serverTimestamp()
          });

          results.push({
            id: doc.id,
            ok: false,
            status: 'failed',
            retryCount,
            error:
              error?.message ??
              'Maximum retry limit reached.'
          });

          continue;
        }

        // ----------------------------------------------
        // Schedule another attempt.
        //
        // Keep the existing retryCount. It was already
        // incremented by publish-instagram.ts.
        // ----------------------------------------------

        await postRef.update({
          status: 'scheduled',

          error:
            error?.message ??
            'Instagram publishing failed.',

          retryCount,

          updatedAt:
            FieldValue.serverTimestamp()
        });

        results.push({
          id: doc.id,
          ok: false,
          status: 'scheduled',
          retryCount,
          retryPending: true,
          error:
            error?.message ??
            'Instagram publishing failed.'
        });
      }
    }

    // --------------------------------------------------
    // Final response
    // --------------------------------------------------

    return res.status(200).json({
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error(
      'Cron publishing error:',
      error
    );

    return res.status(500).json({
      error:
        error?.message ??
        'Cron failed.'
    });
  }
}