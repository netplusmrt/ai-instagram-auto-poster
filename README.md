# Accountancy App — AI Instagram Auto Poster

An AI-powered Instagram content automation application for Accountancy App.

The application can:

- Generate Instagram post content using OpenAI
- Generate promotional images using OpenAI
- Apply the Accountancy App logo to generated images
- Store posts and images in Firebase
- Publish posts to an Instagram Business account through Meta Graph API
- Run through a Vercel serverless API
- Support scheduled automation through Vercel Cron

## Technology Stack

- Angular 20.2.0
- Firebase / Firestore
- Firebase Storage
- Firebase Authentication
- Vercel Serverless Functions
- Vercel Cron
- OpenAI API
- Meta Graph API / Instagram Business API
- Sharp for image/logo processing
- Node.js 22.x

## Project Structure

```text
ai-instagram-auto-poster/
├── api/
│   ├── cron.ts
│   ├── generate-content.ts
│   ├── generate-image.ts
│   ├── publish-instagram.ts
│   └── lib/
│       ├── env.ts
│       ├── firebase-admin.ts
│       └── openai.ts
│
├── public/
│   └── logo.png
│
├── src/
│   ├── app/
│   ├── assets/
│   │   └── logo.png
│   └── ...
│
├── vercel.json
├── package.json
├── tsconfig.json
└── README.md
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

> **Current production note:** The project currently uses `META_GRAPH_VERSION=v26.0`. If your `.env.example` or older setup documentation says `v24.0`, update it to match the Production environment before deployment.

## 6. Run locally

```bash
npm install
npm start
```

To run Angular together with the Vercel serverless API locally:

```bash
vercel dev
```

For local environment variables, use your local `.env`/environment configuration. Never commit secrets to Git.

## Main API Endpoints

### Generate Content

```text
POST /api/generate-content
```

Generates Instagram post ideas/content and stores them in the `social_posts` Firestore collection.

### Generate Image

```text
POST /api/generate-image
```

Generates an image, applies the Accountancy App logo, uploads the result to Firebase Storage, and updates the corresponding social post.

### Publish to Instagram

```text
POST /api/publish-instagram
```

Creates an Instagram media container and publishes it through the Meta Graph API.

### Cron

```text
GET /api/cron
```

Used for scheduled automation.

## Firestore

The application uses the following main collection:

```text
social_posts
```

The payment-related collection used by the separate payment workflow is:

```text
payment_transactions
```

## Environment Variables

Do not commit real secrets to Git.

The following environment variables are required/configured for the application:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET

OPENAI_API_KEY
OPENAI_TEXT_MODEL
OPENAI_IMAGE_MODEL

INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID
META_GRAPH_VERSION
```

Typical model configuration:

```text
OPENAI_TEXT_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-1-mini
META_GRAPH_VERSION=v26.0
```

Keep these secret:

```text
OPENAI_API_KEY
FIREBASE_PRIVATE_KEY
INSTAGRAM_ACCESS_TOKEN
```

Never paste their actual values into source control or public documentation.

## Local Development

### 1. Open the project

```cmd
cd E:\Apps\ai-instagram-auto-poster
```

### 2. Install dependencies

```cmd
npm install
```

### 3. Start Angular

```cmd
npm start
```

### 4. Run Angular with Vercel API locally

```cmd
vercel dev
```

## Build

Verify the application before deployment:

```cmd
npm run build
```

## Firebase Package Check

The Angular project uses Firebase 11.10.0 with AngularFire 20.0.1.

Check installed versions:

```cmd
npm list firebase @angular/fire rxfire
```

Expected relationship:

```text
@angular/fire@20.0.1
firebase@11.10.0
rxfire@6.2.0
```

If dependencies become inconsistent, a clean reinstall can be performed:

```cmd
rmdir /s /q node_modules
del package-lock.json
npm install
```

## Vercel Setup

### Install Vercel CLI

```cmd
npm install -g vercel
```

Check the version:

```cmd
vercel --version
```

Login:

```cmd
vercel login
```

### Link the project

From the project directory:

```cmd
vercel
```

### Deploy Production

```cmd
vercel --prod
```

Production project:

```text
net-plus/ai-instagram-auto-poster
```

Production URL:

```text
https://ai-instagram-auto-poster.vercel.app
```

## Vercel Environment Variables

List configured variables:

```cmd
vercel env ls
```

Pull Production environment variables for local inspection:

```cmd
vercel env pull .env.production.local production
```

### Add a Production variable

```cmd
vercel env add VARIABLE_NAME production
```

### Replace a Production variable

```cmd
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

After changing Production environment variables, redeploy:

```cmd
vercel --prod
```

## Instagram Configuration

The application publishes to the Accountancy App Instagram Business account:

```text
@accountancyapp
```

The application uses:

```text
INSTAGRAM_BUSINESS_ACCOUNT_ID
INSTAGRAM_ACCESS_TOKEN
META_GRAPH_VERSION
```

The Instagram access token is sensitive and must never be committed to Git.

If a token expires, generate a new valid Meta access token and replace the Production environment variable:

```cmd
vercel env rm INSTAGRAM_ACCESS_TOKEN production
vercel env add INSTAGRAM_ACCESS_TOKEN production
vercel --prod
```

## Production Logs

View recent Vercel production logs:
```cmd
vercel logs ai-instagram-auto-poster.vercel.app
```

Last 2 minutes:
```cmd
vercel logs ai-instagram-auto-poster.vercel.app --since 2m
```

Last 10 minutes:
```cmd
vercel logs ai-instagram-auto-poster.vercel.app --since 10m
```

Last 1 hour:
```cmd
vercel logs ai-instagram-auto-poster.vercel.app --since 1h
```

Follow live logs:
```cmd
vercel logs ai-instagram-auto-poster.vercel.app --follow
```

This is useful for troubleshooting:

- Firebase configuration
- OpenAI API errors
- Instagram authentication
- Instagram publishing
- Serverless function errors
- Cron execution

## Scheduled Automation

The current `vercel.json` contains:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```

The schedule is:

```text
09:00 UTC
14:30 IST
```

The Cron endpoint is:

```text
/api/cron
```

Test the production Cron endpoint:

```cmd
curl -X GET https://ai-instagram-auto-poster.vercel.app/api/cron
```

## Logo Branding

The Accountancy App logo is available in:

```text
src/assets/logo.png
public/logo.png
```

The server-side image generation process uses:

```text
public/logo.png
```

Sharp is used to composite the logo onto generated images.

## Current Workflow

```text
Angular Dashboard
       |
       v
Generate Content
       |
       v
Generate Image
       |
       v
Apply Accountancy App Logo
       |
       v
Firebase Storage
       |
       v
Publish Instagram
       |
       v
Instagram @accountancyapp
```

For automated publishing:

```text
Vercel Cron
     |
     v
Generate / Process Post
     |
     v
Firebase
     |
     v
Instagram Graph API
     |
     v
Published Post
```

## Temporary Debug Files

During production troubleshooting, these diagnostic endpoints were used:

```text
api/env-check.ts
api/firebase-check.ts
```

They are currently disabled/retained as:

```text
api/env-check.ts.disabled
api/firebase-check.ts.disabled
```

They should remain disabled unless they are specifically needed for future troubleshooting.

## Recommended Deployment Workflow

### Code changes

```cmd
npm run build
vercel --prod
```

### Environment variable changes

```cmd
vercel env ls
vercel --prod
```

### Troubleshooting after deployment

```cmd
vercel logs ai-instagram-auto-poster.vercel.app --since 2m
```

## Security Notes

Never commit:

```text
.env
.env.local
.env.production.local
```

Do not commit or expose:

```text
OPENAI_API_KEY
FIREBASE_PRIVATE_KEY
INSTAGRAM_ACCESS_TOKEN
```

If a credential is exposed, revoke/rotate it immediately in the corresponding provider.

## Useful Commands — Quick Reference

```cmd
:: Start Angular
npm start

:: Run Angular + Vercel API locally
vercel dev

:: Install dependencies
npm install

:: Build
npm run build

:: Check Firebase packages
npm list firebase @angular/fire rxfire

:: Check Vercel
vercel --version

:: Login
vercel login

:: Check environment variables
vercel env ls

:: Pull Production environment
vercel env pull .env.production.local production

:: Deploy Production
vercel --prod

:: View production logs
vercel logs ai-instagram-auto-poster.vercel.app --since 2m
```

## Status

Current production workflow has been successfully tested through:

```text
Content Generation       ✅
Image Generation         ✅
Logo Branding            ✅
Firebase Storage         ✅
Instagram Authentication ✅
Instagram Publishing     ✅
Production Deployment    ✅
```

Next development focus:

```text
Automated Cron workflow
Post scheduling
Post history/status management
Production hardening
```
