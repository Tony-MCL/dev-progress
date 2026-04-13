// src/auth/useAuthUser.ts
// Clean Build: Minimal Firebase Auth hook.
// - Brukes kun for å få Firebase ID-token (identitet)
// - Worker avgjør alltid plan (free/trial/pro)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

export type AuthUser = {
  uid: string;
  email: string;
};

export type UseAuthUserResult = {
  user: AuthUser | null;
  ready: boolean;

  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Token
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

function getFirebaseConfig() {
  // Vite env vars
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || "");
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "");
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "");

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Missing Firebase env vars. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID."
    );
  }

  return { apiKey, authDomain, projectId };
}

function ensureFirebaseApp() {
  if (getApps().length) return;
  const cfg = getFirebaseConfig();
  initializeApp(cfg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useAuthUser(): UseAuthUserResult {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Brukes for å kunne vente på at auth-state blir klar i prod (race conditions)
  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    try {
      ensureFirebaseApp();
      const auth = getAuth();

      unsub = onAuthStateChanged(auth, (u) => {
        setFbUser(u);
        setReady(true);
      });
    } catch (e) {
      // Hvis env ikke er satt enda, vil appen fortsatt fungere i free-modus.
      console.warn("[auth] Firebase init failed (env missing?)", e);
      setFbUser(null);
      setReady(true);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const user: AuthUser | null = useMemo(() => {
    if (!fbUser) return null;
    const email = fbUser.email || "";
    return { uid: fbUser.uid, email };
  }, [fbUser]);

  const signInFn = useCallback(async (email: string, password: string) => {
    ensureFirebaseApp();
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const registerFn = useCallback(async (email: string, password: string) => {
    ensureFirebaseApp();
    const auth = getAuth();
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOutFn = useCallback(async () => {
    ensureFirebaseApp();
    const auth = getAuth();
    await signOut(auth);
  }, []);

  /**
   * Vent litt på at Firebase faktisk setter currentUser.
   * Dette løser prod-race: register/signIn -> trial/start rett etterpå.
   */
  const waitForCurrentUser = useCallback(async (timeoutMs: number) => {
    ensureFirebaseApp();
    const auth = getAuth();

    // Hvis den allerede finnes, ferdig.
    if (auth.currentUser) return auth.currentUser;

    const start = Date.now();

    // 1) Hvis onAuthStateChanged allerede har kjørt (ready=true) og currentUser fortsatt er null,
    // så finnes det ingen user akkurat nå.
    if (readyRef.current) return null;

    // 2) Vent litt på at auth init blir ferdig. Poll + liten delay er robust i nettleser.
    while (Date.now() - start < timeoutMs) {
      if (auth.currentUser) return auth.currentUser;
      // hvis auth-state blir “klar” uten user, kan vi stoppe tidlig
      if (readyRef.current && !auth.currentUser) return null;
      await sleep(150);
    }

    return auth.currentUser ?? null;
  }, []);

  // ✅ Viktig: hent token fra auth.currentUser (source of truth),
  // men vent litt om den ikke er klar ennå.
  const getIdTokenFn = useCallback(
    async (forceRefresh?: boolean) => {
      try {
        // Vent opptil 5 sek på at currentUser dukker opp etter register/login
        const u = await waitForCurrentUser(5000);
        if (!u) return null;
        return await u.getIdToken(!!forceRefresh);
      } catch (e) {
        console.warn("[auth] getIdToken failed", e);
        return null;
      }
    },
    [waitForCurrentUser]
  );

  return {
    user,
    ready,
    signIn: signInFn,
    register: registerFn,
    signOut: signOutFn,
    getIdToken: getIdTokenFn,
  };
}
