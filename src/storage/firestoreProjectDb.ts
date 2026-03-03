// src/storage/firestoreProjectDb.ts
import type { ProjectDb, ProjectListItem, ProjectRecord, ProgressProjectSnapshotV1 } from "./projectDbTypes";

import { collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { firebaseDb } from "../firebase/firebase";

function normalizeTitle(raw: string): string {
  const t = String(raw ?? "").trim();
  return t || "Untitled project";
}

function nowIso() {
  return new Date().toISOString();
}

export function createFirestoreProjectDb(opts: { uid: string; appId?: string }): ProjectDb {
  const { uid, appId = "progress" } = opts;

  // Per bruker, per app
  const colRef = collection(firebaseDb, "users", uid, "apps", appId, "projects");

  return {
    async list(): Promise<ProjectListItem[]> {
      const q = query(colRef, orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);

      return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
        const x: any = d.data() || {};
        return {
          id: d.id,
          title: normalizeTitle(x.title),
          createdAt: String(x.createdAt ?? ""),
          updatedAt: String(x.updatedAt ?? ""),
        };
      });
    },

    async get(id: string): Promise<ProjectRecord | null> {
      const ref = doc(colRef, String(id));
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;

      const x: any = snap.data() || {};
      return {
        id: snap.id,
        title: normalizeTitle(x.title),
        createdAt: String(x.createdAt ?? ""),
        updatedAt: String(x.updatedAt ?? ""),
        snapshot: x.snapshot as ProgressProjectSnapshotV1,
      };
    },

    async upsert(input: { id?: string; title: string; snapshot: ProgressProjectSnapshotV1 }): Promise<ProjectRecord> {
      const id = input.id ? String(input.id) : doc(colRef).id;
      const ref = doc(colRef, id);

      const existing = await getDoc(ref);
      const createdAt = existing.exists() ? String((existing.data() as any)?.createdAt ?? nowIso()) : nowIso();

      const record: ProjectRecord = {
        id,
        createdAt,
        updatedAt: nowIso(),
        title: normalizeTitle(input.title),
        snapshot: input.snapshot,
      };

      await setDoc(ref, record as any, { merge: true });
      return record;
    },

    async remove(id: string): Promise<void> {
      const ref = doc(colRef, String(id));
      await deleteDoc(ref);
    },

    async duplicate(id: string): Promise<ProjectRecord | null> {
      const orig = await this.get(id);
      if (!orig) return null;

      const copyTitle = `${normalizeTitle(orig.title)} (copy)`;
      const snap = orig.snapshot;

      return this.upsert({
        title: copyTitle,
        snapshot: {
          ...snap,
          title: copyTitle,
        },
      });
    },
  };
}
