# AI Instagram Auto Poster

New Angular + Firebase + Vercel starter for generating AI social posts and publishing them to Instagram.

## Stack

- Angular
- Firebase Firestore
- Firebase Storage
- Vercel Functions
- OpenAI API
- Instagram Graph API

## Important

This repository is a starter implementation. Before production:

1. Enable Firebase Authentication.
2. Replace the permissive Firestore rules with authenticated rules.
3. Never expose OpenAI or Meta secrets in Angular.
4. Verify your Instagram account is eligible for the Meta publishing flow.
5. Test publishing on a dedicated account first.
6. Add approval workflow before enabling fully automatic publishing.

## 1. Install

```bash
npm install
```

## 2. Firebase Web configuration

Edit:

`src/app/firebase.config.ts`

Get the web app config from Firebase Console.

Create:

- Firestore Database
- Storage
- Authentication (recommended before production)

## 3. Firebase Admin environment variables

Create Vercel environment variables from `.env.example`.

`FIREBASE_PRIVATE_KEY` should contain the service-account private key with newline characters escaped as `\n`.

## 4. OpenAI

Set:

```text
OPENAI_API_KEY=...
OPENAI_TEXT_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-1-mini
```

The image model is intentionally the cost-efficient option for the 30-post/month target.

## 5. Instagram / Meta

Set:

```text
META_GRAPH_VERSION=v24.0
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
```

The publishing function uses the standard two-step media-container + media-publish flow.

## 6. Run locally

```bash
npm start
```

Angular runs on:

`http://localhost:4200`

For local Vercel Functions, use Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## 7. Deploy

```bash
vercel
```

Then set the environment variables in Vercel.

For production:

```bash
vercel --prod
```

The included `vercel.json` registers `/api/cron` every 10 minutes.

## 8. Generate an image

The first implementation separates text and image generation:

1. Generate content.
2. Add an image generation button/workflow for a selected post.
3. Store image in Firebase Storage.
4. Publish to Instagram.

The dashboard includes a per-post "Generate image" action. It stores the generated PNG in Firebase Storage and saves a stable Firebase download URL to Firestore.

## 9. Brand logo

The supplied logo is stored at:

`src/assets/logo.png`

Use it as a visual reference/brand element. For consistent production layouts, it is better to overlay the logo in a controlled template rather than ask an image model to reproduce exact logo geometry.

## 10. Suggested production collections

```text
social_posts
social_accounts
content_topics
automation_settings
ai_usage
```

## 11. Suggested post lifecycle

```text
draft
  -> generating
  -> ready
  -> approved
  -> scheduled
  -> publishing
  -> published

failed -> retry -> publishing
```