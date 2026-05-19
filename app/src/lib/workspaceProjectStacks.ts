type WorkspaceProjectStackRecord = {
  adId: number | null;
  createdAt?: string | null;
  editedFromProjectAdId: number | null;
  generatedAt?: string | null;
  id: string;
  updatedAt: string;
  versionRootProjectAdId: number | null;
};

export type WorkspaceProjectStackGroup<TProject extends WorkspaceProjectStackRecord> = {
  isStack: boolean;
  key: string;
  leadProject: TProject;
  projects: TProject[];
};

const getProjectVersionSortTime = (
  project: Pick<WorkspaceProjectStackRecord, "createdAt" | "generatedAt" | "updatedAt">,
) => {
  const timestamp = Date.parse(project.generatedAt || project.createdAt || project.updatedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const compareProjectsByVersionTimeDesc = <
  TProject extends Pick<WorkspaceProjectStackRecord, "createdAt" | "generatedAt" | "id" | "updatedAt">,
>(
  left: TProject,
  right: TProject,
) => {
  const timeDifference = getProjectVersionSortTime(right) - getProjectVersionSortTime(left);
  if (timeDifference !== 0) {
    return timeDifference;
  }

  return left.id.localeCompare(right.id);
};

const getProjectStackKey = (project: WorkspaceProjectStackRecord) => {
  if (project.versionRootProjectAdId !== null) {
    return String(project.versionRootProjectAdId);
  }

  if (project.adId !== null) {
    return String(project.adId);
  }

  return `legacy:${project.id}`;
};

export const buildWorkspaceProjectStackGroups = <TProject extends WorkspaceProjectStackRecord>(
  projects: TProject[],
): WorkspaceProjectStackGroup<TProject>[] => {
  const groups = new Map<string, TProject[]>();

  projects.forEach((project) => {
    const groupKey = getProjectStackKey(project);
    const currentGroup = groups.get(groupKey);

    if (currentGroup) {
      currentGroup.push(project);
      return;
    }

    groups.set(groupKey, [project]);
  });

  return Array.from(groups.entries())
    .map(([key, groupedProjects]) => {
      const sortedProjects = [...groupedProjects].sort(compareProjectsByVersionTimeDesc);
      const leadProject = sortedProjects[0];

      if (!leadProject) {
        return null;
      }

      return {
        isStack:
          sortedProjects.length > 1 &&
          sortedProjects.some((project) => project.versionRootProjectAdId !== null),
        key,
        leadProject,
        projects: sortedProjects,
      };
    })
    .filter((group): group is WorkspaceProjectStackGroup<TProject> => Boolean(group))
    .sort((left, right) => compareProjectsByVersionTimeDesc(left.leadProject, right.leadProject));
};
