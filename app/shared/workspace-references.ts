export type WorkspaceReferenceKind = "character" | "scene";

export type WorkspaceSavedReference = {
  assetId: number;
  createdAt: string;
  description: string | null;
  id: string;
  kind: WorkspaceReferenceKind;
  name: string;
  sourceProjectId: number | null;
  sourceSegmentIndex: number | null;
  updatedAt: string;
};

export type WorkspaceSavedReferencesPayload = {
  references: WorkspaceSavedReference[];
};

export const isWorkspaceReferenceKind = (value: unknown): value is WorkspaceReferenceKind =>
  value === "character" || value === "scene";

