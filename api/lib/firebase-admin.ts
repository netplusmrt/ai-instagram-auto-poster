import { cert, getApps, initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function getAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const projectId = getEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getEnv('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const storageBucket = getEnv('FIREBASE_STORAGE_BUCKET');

  console.log('Firebase Admin runtime check:', {
    projectId: !!projectId,
    clientEmail: !!clientEmail,
    privateKey: !!privateKey,
    storageBucket: !!storageBucket
  });

  const missing: string[] = [];

  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase Admin environment variables: ${missing.join(', ')}`
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    }),
    storageBucket
  });
}

export function getDb() {
  return getFirestore(getAdminApp());
}

export function getStorage() {
  return getAdminStorage(getAdminApp());
}