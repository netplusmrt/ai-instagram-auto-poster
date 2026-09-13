import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebase-admin';
import { openai } from './lib/openai';

const SYSTEM_PROMPT = `
You are a social media content strategist for AccountancyApp, an Indian accounting
software/business brand. Create concise, useful Instagram content for Indian small
business owners. Use simple Hinglish/English. Avoid invented statistics, legal claims,
prices, or guarantees. Return strict JSON only:
{
  "posts": [
    {
      "title": "...",
      "caption": "...",
      "cta": "...",
      "hashtags": ["#...", "#..."],
      "imagePrompt": "..."
    }
  ]
}
The image prompt must describe a professional 1080x1080 Instagram visual, leave clean
space for headline overlay, and use navy + orange brand styling. Do not ask the user
questions.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const topic = String(req.body?.topic ?? '').trim();
    const count = Math.min(Math.max(Number(req.body?.count ?? 1), 1), 30);

    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create ${count} distinct Instagram post ideas around: ${topic}` }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? '{"posts":[]}';
    const parsed = JSON.parse(raw) as { posts: any[] };

    let created = 0;

    for (const post of parsed.posts.slice(0, count)) {
      const ref = db.collection('social_posts').doc();
      await ref.set({
        platform: 'instagram',
        topic,
        title: post.title,
        caption: `${post.caption}\n\n${post.cta}`,
        hashtags: post.hashtags ?? [],
        imageUrl: '',
        imagePrompt: post.imagePrompt,
        status: 'ready',
        scheduledAt: null,
        publishedAt: null,
        instagramMediaId: null,
        retryCount: 0,
        error: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      created++;
    }

    return res.status(200).json({ created });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error?.message ?? 'Generation failed.' });
  }
}