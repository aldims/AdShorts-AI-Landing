export type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
  userId?: string | null;
};

export const normalizeWorkspacePlan = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

export const normalizeWorkspaceBalance = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

export const normalizeWorkspaceExpiry = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export const normalizeWorkspaceStartPlanUsed = (value: unknown, plan: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return normalizeWorkspacePlan(plan) === "START";
};

export const normalizeWorkspaceUserId = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export const areWorkspaceProfilesEqual = (
  left: WorkspaceProfile | null | undefined,
  right: WorkspaceProfile | null | undefined,
) =>
  normalizeWorkspacePlan(left?.plan) === normalizeWorkspacePlan(right?.plan) &&
  normalizeWorkspaceBalance(left?.balance) === normalizeWorkspaceBalance(right?.balance) &&
  normalizeWorkspaceExpiry(left?.expiresAt) === normalizeWorkspaceExpiry(right?.expiresAt) &&
  normalizeWorkspaceStartPlanUsed(left?.startPlanUsed, left?.plan) ===
    normalizeWorkspaceStartPlanUsed(right?.startPlanUsed, right?.plan) &&
  normalizeWorkspaceUserId(left?.userId) === normalizeWorkspaceUserId(right?.userId);
