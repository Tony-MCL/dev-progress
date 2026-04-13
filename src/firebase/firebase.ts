// src/firebase/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Minimum required for Auth/Firestore in your use case
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // appId/storageBucket/messagingSenderId intentionally omitted
};

// Unngå "already exists" ved HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Backwards-compatible exports
export const firebaseApp = app;
export const firebaseAuth = auth;
export const firebaseDb = db;
