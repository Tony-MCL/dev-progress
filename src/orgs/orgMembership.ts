// src/orgs/orgMembership.ts
// 🔥 CLEAN RESET: Ingen Firestore. Beholdt kun som API-shape placeholder.

export type OrgMembership = {
  orgId: string;
  role: string;
  active: boolean;
  name?: string;
  plan?: string;
};

export async function listUserOrgMemberships(_uid: string): Promise<OrgMembership[]> {
  return [];
}
