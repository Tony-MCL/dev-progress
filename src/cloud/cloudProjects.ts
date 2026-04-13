// src/cloud/cloudProjects.ts
//
// Clean-room: App skal IKKE skrive direkte til Firestore.
// All skylagring går via Cloudflare Worker (API) med Firebase ID token.

import type { ProgressProjectSnapshotV1 } from "../storage/projectDbTypes";

export type CloudProjectSaveArgs = {
  apiBase: string;
  token: string;

  orgId: string;
  uid: string;

  title: string;
  snapshot: ProgressProjectSnapshotV1;

  projectId?: string | null;
};

export type CloudProjectSaveResult = {
  id: string;
  updatedAt?: string;
  [k: string]: any;
};

export type CloudProjectListItem = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  createdBy?: string;
  summary?: {
    rows?: number;
    start?: string;
    end?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

export type CloudProjectListResult = {
  projects: CloudProjectListItem[];
  [k: string]: any;
};

export type CloudProjectGetArgs = {
  apiBase: string;
  token: string;
  projectId: string;
  // (valgfritt, avhengig av Worker)
  orgId?: string;
};

export type CloudProjectGetResult = {
  id: string;
  title: string;
  snapshot: ProgressProjectSnapshotV1;
  updatedAt?: string;
  [k: string]: any;
};

async function readJsonBestEffort(r: Response): Promise<any | null> {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function normBase(url: string) {
  return String(url || "").trim().replace(/\/+$/g, "");
}

function mustToken(token: string) {
  const t = String(token || "").trim();
  if (!t) throw new Error("MISSING_AUTH_TOKEN");
  return t;
}

/**
 * Pro skylagring (v1) via Worker.
 * Returnerer { id } for nytt/eksisterende prosjekt.
 */
export async function saveProgressProjectToCloud(
  opts: CloudProjectSaveArgs
): Promise<CloudProjectSaveResult> {
  const apiBase = normBase(opts.apiBase);
  if (!apiBase) throw new Error("MISSING_API_BASE");

  const token = mustToken(opts.token);

  const orgId = String(opts.orgId || "").trim();
  const uid = String(opts.uid || "").trim();
  if (!orgId) throw new Error("MISSING_ORG_ID");
  if (!uid) throw new Error("MISSING_UID");

  const title = String(opts.title || "").trim() || "Untitled project";
  const snapshot = opts.snapshot;

  if (!snapshot || (snapshot as any).v !== 1) {
    throw new Error("INVALID_SNAPSHOT");
  }

  const url = `${apiBase}/projects/save`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      product: "progress",
      orgId,
      uid,
      projectId: opts.projectId ?? null,
      title,
      snapshot,
    }),
  });

  const data = await readJsonBestEffort(r);

  if (!r.ok) {
    const msg = String(
      data?.error || data?.message || `cloud_save_failed:${r.status}`
    );
    throw new Error(msg);
  }

  const id = String(data?.id || "").trim();
  if (!id) throw new Error("CLOUD_SAVE_MISSING_ID");

  return {
    id,
    updatedAt: data?.updatedAt ? String(data.updatedAt) : undefined,
    ...(data && typeof data === "object" ? data : {}),
  };
}

/**
 * F2: List cloud projects (via Worker).
 * Endpoint: GET {apiBase}/projects/list
 * Worker kan enten:
 *  - inferere org fra token, eller
 *  - ta orgId som query (valgfritt)
 */
export async function listProgressProjectsFromCloud(opts: {
  apiBase: string;
  token: string;
  orgId?: string;
}): Promise<CloudProjectListResult> {
  const apiBase = normBase(opts.apiBase);
  if (!apiBase) throw new Error("MISSING_API_BASE");
  const token = mustToken(opts.token);

  const orgId = String(opts.orgId || "").trim();
  const url = orgId
    ? `${apiBase}/projects/list?orgId=${encodeURIComponent(orgId)}`
    : `${apiBase}/projects/list`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });

  const data = await readJsonBestEffort(r);

  if (!r.ok) {
    const msg = String(
      data?.error || data?.message || `cloud_list_failed:${r.status}`
    );
    throw new Error(msg);
  }

  const raw = Array.isArray(data?.projects) ? data.projects : [];
  const projects: CloudProjectListItem[] = raw.map((p: any) => ({
    id: String(p?.id ?? p?.projectId ?? "").trim(),
    title: String(p?.title ?? p?.name ?? "").trim() || "Untitled project",
    updatedAt: String(p?.updatedAt ?? p?.updated ?? "").trim() || "",
    createdAt: p?.createdAt ? String(p.createdAt) : undefined,
    createdBy: p?.createdBy ? String(p.createdBy) : undefined,
    summary: p?.summary && typeof p.summary === "object" ? p.summary : undefined,
    ...(p && typeof p === "object" ? p : {}),
  })).filter((x: CloudProjectListItem) => !!x.id);

  return { projects, ...(data && typeof data === "object" ? data : {}) };
}

/**
 * F2: Get one cloud project snapshot (via Worker).
 * Endpoint: GET {apiBase}/projects/get?projectId=...
 */
export async function getProgressProjectFromCloud(
  opts: CloudProjectGetArgs
): Promise<CloudProjectGetResult> {
  const apiBase = normBase(opts.apiBase);
  if (!apiBase) throw new Error("MISSING_API_BASE");
  const token = mustToken(opts.token);

  const projectId = String(opts.projectId || "").trim();
  if (!projectId) throw new Error("MISSING_PROJECT_ID");

  const orgId = String(opts.orgId || "").trim();
  const url =
    `${apiBase}/projects/get?projectId=${encodeURIComponent(projectId)}` +
    (orgId ? `&orgId=${encodeURIComponent(orgId)}` : "");

  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });

  const data = await readJsonBestEffort(r);

  if (!r.ok) {
    const msg = String(
      data?.error || data?.message || `cloud_get_failed:${r.status}`
    );
    throw new Error(msg);
  }

  const id = String(data?.id ?? data?.projectId ?? projectId).trim();
  const title = String(data?.title ?? data?.name ?? "").trim() || "Untitled project";
  const snapshot = data?.snapshot as ProgressProjectSnapshotV1;

  if (!snapshot || (snapshot as any).v !== 1) {
    throw new Error("CLOUD_GET_INVALID_SNAPSHOT");
  }

  return {
    id,
    title,
    snapshot,
    updatedAt: data?.updatedAt ? String(data.updatedAt) : undefined,
    ...(data && typeof data === "object" ? data : {}),
  };
}
