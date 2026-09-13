import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const missing = [];

  if (!process.env.FIREBASE_PROJECT_ID) {
    missing.push('FIREBASE_PROJECT_ID');
  }

  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    missing.push('FIREBASE_CLIENT_EMAIL');
  }

  if (!privateKey) {
    missing.push('FIREBASE_PRIVATE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing Firebase Admin environment variables: ${missing.join(', ')}`);
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

export const adminApp = getAdminApp();
export const db = getFirestore(adminApp);
export const storage = getStorage(adminApp);