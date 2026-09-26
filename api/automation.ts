import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb, getStorage } from './lib/firebase-admin.js';
import { openai } from './lib/openai.js';
import sharp from 'sharp';
import path from 'path';

const SYSTEM_PROMPT = `
You are a social media content strategist for AccountancyApp, an Indian accounting
software/business brand.

Create concise, useful Instagram content for Indian small business owners.

Use simple Hinglish/English.

Avoid invented statistics, legal claims, prices, guarantees, or unsupported claims.

Return strict JSON only:

{
  "title": "...",
  "caption": "...",
  "cta": "...",
  "hashtags": ["#...", "#..."],
  "imagePrompt": "..."
}

The image prompt must describe a professional 1080x1080 Instagram visual,
leave clean space for headline overlay, and use navy + orange brand styling.

Do not ask questions.
`;

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};


/**
 * Calculate the next scheduled posting date/time.
 *
 * Current supported timezone:
 * Asia/Kolkata
 */
function getNextSchedule(settings: any): Date {
  const postingDays: string[] =
    Array.isArray(settings.postingDays)
      ? settings.postingDays.map((day: string) =>
          String(day).toLowerCase()
        )
      : [];

  if (!postingDays.length) {
    throw new Error('No posting days configured.');
  }

  const postingTime =
    String(settings.postingTime || '14:30');

  const [hours, minutes] =
    postingTime.split(':').map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('Invalid posting time.');
  }

  const now = new Date();

  /*
   * Get today's date in Asia/Kolkata.
   */
  const indiaParts = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(now);

  const year =
    Number(
      indiaParts.find(p => p.type === 'year')?.value
    );

  const month =
    Number(
      indiaParts.find(p => p.type === 'month')?.value
    );

  const day =
    Number(
      indiaParts.find(p => p.type === 'day')?.value
    );

  /*
   * Build candidates for the next 14 days.
   *
   * We construct the IST date explicitly and then
   * convert IST (UTC+05:30) to UTC.
   */
  for (let offset = 0; offset < 14; offset++) {

    const candidateDate =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day + offset,
          hours,
          minutes,
          0,
          0
        )
      );

    /*
     * candidateDate currently represents the requested
     * clock time as if it were UTC.
     *
     * Convert 14:30 IST -> 09:00 UTC.
     */
    const utcCandidate =
      new Date(
        candidateDate.getTime() -
        (5.5 * 60 * 60 * 1000)
      );

    /*
     * Determine weekday using the IST calendar date.
     */
    const weekday =
      new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone: 'Asia/Kolkata',
          weekday: 'long'
        }
      )
        .format(utcCandidate)
        .toLowerCase();

    if (!postingDays.includes(weekday)) {
      continue;
    }

    /*
     * Only return a future schedule.
     */
    if (
      utcCandidate.getTime() >
      now.getTime()
    ) {
      return utcCandidate;
    }
  }

  throw new Error(
    'Unable to calculate the next automation schedule.'
  );
}


/**
 * Prevent duplicate scheduled posts for the same time slot.
 */
async function hasScheduledPost(
  scheduledAt: Date
): Promise<boolean> {

  const db =
    getDb();

  /*
   * Allow a small one-minute tolerance.
   */
  const start =
    new Date(
      scheduledAt.getTime() -
      60 * 1000
    );

  const end =
    new Date(
      scheduledAt.getTime() +
      60 * 1000
    );

  const snapshot =
    await db
      .collection('social_posts')
      .where(
        'status',
        'in',
        [
          'scheduled',
          'publishing',
          'published'
        ]
      )
      .where(
        'scheduledAt',
        '>=',
        Timestamp.fromDate(start)
      )
      .where(
        'scheduledAt',
        '<=',
        Timestamp.fromDate(end)
      )
      .limit(1)
      .get();

  return !snapshot.empty;
}


/**
 * Generate one AccountancyApp post.
 */
async function generateContent() {

  const topic =
    `
    AccountancyApp promotional and educational content
    for Indian small businesses.

    Cover useful topics such as:
    - Billing
    - Invoicing
    - GST
    - Inventory
    - Customer management
    - Business reports
    - Accounting
    - Business productivity

    Create a fresh concept that is different from previous posts.
    `;

  const completion =
    await openai.chat.completions.create({

      model:
        process.env.OPENAI_TEXT_MODEL ||
        'gpt-5-mini',

      response_format: {
        type: 'json_object'
      },

      messages: [

        {
          role: 'system',
          content: SYSTEM_PROMPT
        },

        {
          role: 'user',
          content:
            `Create one fresh Instagram post around:
${topic}`
        }

      ]

    });

  const raw =
    completion
      .choices[0]
      ?.message
      ?.content ?? '{}';

  const parsed =
    JSON.parse(raw);

  if (!parsed.title) {
    throw new Error(
      'AI did not return a post title.'
    );
  }

  if (!parsed.caption) {
    throw new Error(
      'AI did not return a caption.'
    );
  }

  if (!parsed.imagePrompt) {
    throw new Error(
      'AI did not return an image prompt.'
    );
  }

  return {

    title:
      String(parsed.title),

    caption:
      [
        String(parsed.caption),

        parsed.cta
          ? String(parsed.cta)
          : ''
      ]
        .filter(Boolean)
        .join('\n\n'),

    hashtags:
      Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(String)
        : [],

    imagePrompt:
      String(parsed.imagePrompt)

  };
}


/**
 * Generate and upload the AccountancyApp image.
 */
async function generateImage(
  postId: string,
  imagePrompt: string
): Promise<string> {

  const result =
    await openai.images.generate({

      model:
        process.env.OPENAI_IMAGE_MODEL ||
        'gpt-image-1-mini',

      prompt:
        imagePrompt,

      size:
        '1024x1024'

    });

  const imageBase64 =
    result.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error(
      'OpenAI did not return an image.'
    );
  }

  const imageBuffer =
    Buffer.from(
      imageBase64,
      'base64'
    );


  /*
   * AccountancyApp logo.
   */
  const logoPath =
    path.join(
      process.cwd(),
      'public',
      'logo.png'
    );


  const logoBuffer =
    await sharp(logoPath)
      .resize({
        width: 120,
        withoutEnlargement: true
      })
      .png()
      .toBuffer();


  /*
   * Add logo bottom-right.
   */
  const brandedImage =
    await sharp(imageBuffer)
      .composite([
        {
          input: logoBuffer,
          gravity: 'southeast'
        }
      ])
      .png()
      .toBuffer();


  /*
   * Firebase Storage.
   */
  const filePath =
    `social-posts/${postId}.png`;

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error(
      'FIREBASE_STORAGE_BUCKET is missing at runtime.'
    );
  }

  const storage =
    getStorage();

  const bucket =
    storage.bucket(bucketName);

  const file =
    bucket.file(filePath);


  await file.save(
    brandedImage,
    {
      metadata: {

        contentType:
          'image/png',

        metadata: {
          postId,
          generatedBy:
            'automation',
          branded:
            'true'
        }

      }
    }
  );


  /*
   * Instagram needs a publicly accessible image URL.
   */
  await file.makePublic();


  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}


/**
 * Main Automation API
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  if (req.method !== 'POST') {

    return res.status(405).json({
      error:
        'Method not allowed'
    });

  }


  try {

    /*
     * Protect the endpoint when called by Cron.
     */
    const cronSecret =
      process.env.CRON_SECRET;

    if (
      cronSecret &&
      req.headers.authorization !==
        `Bearer ${cronSecret}`
    ) {

      return res.status(401).json({
        error:
          'Unauthorized'
      });

    }


    const db =
      getDb();


    /*
     * Load Automation settings.
     */
    const settingsRef =
      db
        .collection('automation_settings')
        .doc('instagram');

    const settingsSnap =
      await settingsRef.get();


    if (!settingsSnap.exists) {

      return res.status(200).json({

        ok: true,

        skipped: true,

        reason:
          'Automation settings do not exist.'

      });

    }


    const settings =
      settingsSnap.data();


    /*
     * Automation disabled.
     */
    if (
      settings?.automationEnabled !== true
    ) {

      return res.status(200).json({

        ok: true,

        skipped: true,

        reason:
          'Automation is disabled.'

      });

    }


    /*
     * Make sure the automatic workflow
     * is enabled.
     */
    if (
      settings?.autoGenerateContent === false ||
      settings?.autoGenerateImage === false ||
      settings?.autoSchedule === false
    ) {

      return res.status(200).json({

        ok: true,

        skipped: true,

        reason:
          'One or more automation steps are disabled.'

      });

    }


    /*
     * Calculate next posting slot.
     */
    const scheduledAt =
      getNextSchedule(settings);


    /*
     * Duplicate protection.
     */
    const duplicate =
      await hasScheduledPost(
        scheduledAt
      );

    if (duplicate) {

      return res.status(200).json({

        ok: true,

        skipped: true,

        reason:
          'A post already exists for this scheduled slot.',

        scheduledAt:
          scheduledAt.toISOString()

      });

    }


    /*
     * Generate AI content.
     */
    const content =
      await generateContent();


    /*
     * Create Firestore post.
     *
     * We create the document first so that
     * the image has a stable post ID.
     */
    const postRef =
      db
        .collection('social_posts')
        .doc();


    await postRef.set({

      platform:
        'instagram',

      topic:
        'Automatic AccountancyApp content',

      title:
        content.title,

      caption:
        content.caption,

      hashtags:
        content.hashtags,

      imageUrl:
        '',

      imagePrompt:
        content.imagePrompt,

      status:
        'generating_image',

      scheduledAt:
        Timestamp.fromDate(
          scheduledAt
        ),

      publishedAt:
        null,

      instagramMediaId:
        null,

      retryCount:
        0,

      error:
        null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp()

    });


    /*
     * Generate image.
     */
    try {

      const imageUrl =
        await generateImage(
          postRef.id,
          content.imagePrompt
        );


      /*
       * Image generated successfully.
       *
       * The post is now ready for
       * the existing publishing Cron.
       */
      await postRef.update({

        imageUrl,

        status:
          'scheduled',

        error:
          null,

        updatedAt:
          FieldValue.serverTimestamp()

      });


    } catch (imageError: any) {

      /*
       * Keep the failed post visible in
       * the dashboard for troubleshooting.
       */
      await postRef.update({

        status:
          'failed',

        error:
          imageError?.message ??
          'Automatic image generation failed.',

        retryCount:
          FieldValue.increment(1),

        updatedAt:
          FieldValue.serverTimestamp()

      });

      throw imageError;
    }


    /*
     * Successful automation run.
     */
    return res.status(200).json({

      ok: true,

      postId:
        postRef.id,

      status:
        'scheduled',

      scheduledAt:
        scheduledAt.toISOString(),

      title:
        content.title

    });


  } catch (error: any) {

    console.error(
      'Automation error:',
      error
    );

    return res.status(500).json({

      error:
        error?.message ??
        'Automation failed.'

    });

  }

}