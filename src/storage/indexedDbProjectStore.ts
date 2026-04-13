// src/storage/indexedDbProjectStore.ts
import type { ProjectDb, ProjectListItem, ProjectRecord, ProgressProjectSnapshotV1 } from "./projectDbTypes";

const DB_NAME = "mcl-progress-db";
const DB_VERSION = 1;
const STORE = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("title", "title", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);

    let req: IDBRequest<T> | void;
    try {
      req = run(store);
    } catch (e) {
      reject(e);
      return;
    }

    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }

    t.oncomplete = () => {
      if (!req) resolve();
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function newId(): string {
  return `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeTitle(raw: string): string {
  const t = String(raw ?? "").trim();
  return t || "Untitled project";
}

export function createIndexedDbProjectStore(): ProjectDb {
  return {
    async list(): Promise<ProjectListItem[]> {
      const db = await openDb();
      const all = (await tx<any[]>(db, "readonly", (store) => store.getAll())) as any[];

      const items: ProjectListItem[] = (all || [])
        .filter(Boolean)
        .map((x) => ({
          id: String(x.id),
          title: normalizeTitle(String(x.title ?? "")),
          createdAt: String(x.createdAt ?? ""),
          updatedAt: String(x.updatedAt ?? ""),
        }))
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

      db.close();
      return items;
    },

    async get(id: string): Promise<ProjectRecord | null> {
      const db = await openDb();
      const rec = (await tx<any>(db, "readonly", (store) => store.get(String(id)))) as any;
      db.close();

      if (!rec) return null;

      return {
        id: String(rec.id),
        title: normalizeTitle(String(rec.title ?? "")),
        createdAt: String(rec.createdAt ?? ""),
        updatedAt: String(rec.updatedAt ?? ""),
        snapshot: rec.snapshot as ProgressProjectSnapshotV1,
      };
    },

    async upsert(input: { id?: string; title: string; snapshot: ProgressProjectSnapshotV1 }): Promise<ProjectRecord> {
      const db = await openDb();

      const id = input.id ? String(input.id) : newId();
      const now = new Date().toISOString();

      const existing = (await tx<any>(db, "readonly", (store) => store.get(id))) as any;
      const createdAt = existing?.createdAt ? String(existing.createdAt) : now;

      const record: ProjectRecord = {
        id,
        createdAt,
        updatedAt: now,
        title: normalizeTitle(input.title),
        snapshot: input.snapshot,
      };

      await tx(db, "readwrite", (store) => store.put(record as any));
      db.close();
      return record;
    },

    async remove(id: string): Promise<void> {
      const db = await openDb();
      await tx(db, "readwrite", (store) => store.delete(String(id)));
      db.close();
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
