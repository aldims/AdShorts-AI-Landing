export const firstVideoOfferVariants = ["plans_redirect_v1", "start_direct_v1"] as const;

export type FirstVideoOfferVariant = (typeof firstVideoOfferVariants)[number];

export const activeFirstVideoOfferVariant: FirstVideoOfferVariant = "start_direct_v1";

export const isFirstVideoOfferEligible = ({
  firstVideoActionsExpanded,
  hasLoadedProjects,
  hasVisibleVideo,
  locale,
  plan,
  projectsFailed,
  readyProjectsCount,
  startPlanUsed,
}: {
  firstVideoActionsExpanded: boolean;
  hasLoadedProjects: boolean;
  hasVisibleVideo: boolean;
  locale: "ru" | "en";
  plan: string | null;
  projectsFailed: boolean;
  readyProjectsCount: number;
  startPlanUsed: boolean;
}) =>
  locale === "ru" &&
  plan === "FREE" &&
  !startPlanUsed &&
  firstVideoActionsExpanded &&
  hasVisibleVideo &&
  hasLoadedProjects &&
  !projectsFailed &&
  readyProjectsCount <= 1;
