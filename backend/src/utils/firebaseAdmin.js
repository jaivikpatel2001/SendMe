const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let initialized = false;

function initFirebaseAdmin() {
  if (initialized) return admin;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      const absolutePath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(process.cwd(), serviceAccountPath);
      const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        })
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Fallback to ADC if available
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      logger.warn('Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* vars.');
      return null;
    }

    initialized = true;
    logger.info('Firebase Admin initialized');
    return admin;
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin', { error: err.message });
    return null;
  }
}

async function verifyIdToken(idToken) {
  const instance = initFirebaseAdmin();
  if (!instance) return null;
  try {
    const decoded = await instance.auth().verifyIdToken(idToken, true);
    return decoded;
  } catch (err) {
    logger.debug('Firebase token verification failed', { error: err.message });
    return null;
  }
}

module.exports = {
  initFirebaseAdmin,
  verifyIdToken,
};

