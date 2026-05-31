import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import type { Locale } from "../../lib/i18n";
import {
  formatWorkspaceContentPlanIdeaCount,
  type WorkspaceContentPlan,
  type WorkspaceContentPlanIdea,
} from "./workspace-content-plan-helpers";
import { workspaceText } from "./workspace-page-model";
import { formatProjectDate } from "./workspace-publish-helpers";

type WorkspaceContentPlanPanelProps = {
  activePlanId: string | null;
  contentPlans: WorkspaceContentPlan[];
  deletingIdeaId: string | null;
  deletingPlanId: string | null;
  error: string | null;
  expandedUsedIdeasPlanId: string | null;
  isGenerating: boolean;
  isLoading: boolean;
  isVisible: boolean;
  locale: Locale;
  onDeleteIdea: (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => void | Promise<void>;
  onDeletePlan: (plan: WorkspaceContentPlan) => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
  onQueryInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRegeneratePlan: (plan: WorkspaceContentPlan) => void | Promise<void>;
  onRetryLoad: () => void;
  onSelectIdea: (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => void;
  onToggleIdeaUsed: (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => void | Promise<void>;
  onToggleVisibility: () => void;
  panelRef: RefObject<HTMLElement | null>;
  queryInput: string;
  selectedIdeaId: string | null;
  setActivePlanId: Dispatch<SetStateAction<string | null>>;
  setExpandedUsedIdeasPlanId: Dispatch<SetStateAction<string | null>>;
  updatingIdeaId: string | null;
};

export function WorkspaceContentPlanPanel({
  activePlanId,
  contentPlans,
  deletingIdeaId,
  deletingPlanId,
  error,
  expandedUsedIdeasPlanId,
  isGenerating,
  isLoading,
  isVisible,
  locale,
  onDeleteIdea,
  onDeletePlan,
  onGenerate,
  onQueryInputChange,
  onRegeneratePlan,
  onRetryLoad,
  onSelectIdea,
  onToggleIdeaUsed,
  onToggleVisibility,
  panelRef,
  queryInput,
  selectedIdeaId,
  setActivePlanId,
  setExpandedUsedIdeasPlanId,
  updatingIdeaId,
}: WorkspaceContentPlanPanelProps) {
  const renderIdeaCard = (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => {
    const isSelectedIdea = selectedIdeaId === idea.id;
    const isDeletingIdea = deletingIdeaId === idea.id;
    const isUpdatingIdea = updatingIdeaId === idea.id;

    return (
      <article
        key={idea.id}
        className={`studio-content-plan__idea${idea.isUsed ? " is-used" : ""}${isSelectedIdea ? " is-selected" : ""}`}
      >
        <div className="studio-content-plan__idea-meta">
          <button
            className={`studio-content-plan__idea-status${idea.isUsed ? " is-active" : ""}`}
            type="button"
            aria-pressed={idea.isUsed}
            aria-label={
              idea.isUsed
                ? workspaceText(locale, "Пометить как неиспользованную", "Mark as unused")
                : workspaceText(locale, "Пометить как использованную", "Mark as used")
            }
            aria-busy={isUpdatingIdea || isDeletingIdea}
            disabled={isUpdatingIdea || isDeletingIdea}
            onClick={() => void onToggleIdeaUsed(plan, idea)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.25 8.25 6.2 11.2l6.55-6.55"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <button
          className="studio-content-plan__idea-main"
          type="button"
          aria-pressed={isSelectedIdea}
          disabled={isDeletingIdea}
          onClick={() => onSelectIdea(plan, idea)}
        >
          <span className="studio-content-plan__idea-main-copy">
            <strong>{idea.title}</strong>
            <p className="studio-content-plan__idea-summary">{idea.summary}</p>
          </span>
        </button>

        <div className="studio-content-plan__idea-actions">
          <button
            className="studio-content-plan__idea-delete"
            type="button"
            aria-label={workspaceText(locale, `Удалить идею ${idea.title}`, `Delete idea ${idea.title}`)}
            disabled={isDeletingIdea}
            onClick={() => void onDeleteIdea(plan, idea)}
          >
            {isDeletingIdea ? (
              <span className="studio-canvas-prompt__btn-spinner" aria-hidden="true"></span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16" strokeLinecap="round" />
                <path d="M9.5 4h5l1 2h4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7l.8 11a2 2 0 0 0 2 1.86h2.4a2 2 0 0 0 2-1.86L16 7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 10.5v5.5M14 10.5v5.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </article>
    );
  };

  const renderPlanSection = (plan: WorkspaceContentPlan) => {
    const planIdeas = plan.ideas.slice().sort((left, right) => left.position - right.position);
    const unusedIdeas = planIdeas.filter((idea) => !idea.isUsed);
    const usedIdeas = planIdeas.filter((idea) => idea.isUsed);
    const isExpandedPlan = activePlanId === plan.id;
    const isUsedIdeasExpanded = expandedUsedIdeasPlanId === plan.id;

    return (
      <section key={plan.id} className={`studio-content-plan__plan${isExpandedPlan ? " is-expanded" : ""}`}>
        <button
          className={`studio-content-plan__plan-toggle${isExpandedPlan ? " is-expanded" : ""}`}
          type="button"
          aria-expanded={isExpandedPlan}
          onClick={() => setActivePlanId((current) => (current === plan.id ? null : plan.id))}
        >
          <span className="studio-content-plan__plan-toggle-copy">
            <strong>{plan.query}</strong>
            <span>{formatProjectDate(plan.updatedAt, locale)}</span>
          </span>
          <span className="studio-content-plan__plan-toggle-meta">
            <span className="studio-content-plan__plan-toggle-stats">
              {workspaceText(locale, `${unusedIdeas.length}/${plan.ideas.length} новых`, `${unusedIdeas.length}/${plan.ideas.length} new`)}
            </span>
            <span className={`studio-content-plan__plan-chevron${isExpandedPlan ? " is-expanded" : ""}`} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="m4.25 6.25 3.75 3.75 3.75-3.75"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </button>

        {isExpandedPlan ? (
          <div className="studio-content-plan__plan-panel">
            <div className="studio-content-plan__ideas-group">
              {unusedIdeas.length > 0 ? (
                <div className="studio-content-plan__ideas">
                  {unusedIdeas.map((idea) => renderIdeaCard(plan, idea))}
                </div>
              ) : (
                <div className="studio-content-plan__state is-compact">
                  <p>
                    {workspaceText(
                      locale,
                      "В этом плане не осталось новых идей. Можно открыть использованные ниже или сгенерировать ещё.",
                      "This plan has no new ideas left. Open used ideas below or generate more.",
                    )}
                  </p>
                </div>
              )}
            </div>

            {usedIdeas.length > 0 ? (
              <section className={`studio-content-plan__used-group${isUsedIdeasExpanded ? " is-expanded" : ""}`}>
                <button
                  className={`studio-content-plan__used-toggle${isUsedIdeasExpanded ? " is-expanded" : ""}`}
                  type="button"
                  aria-expanded={isUsedIdeasExpanded}
                  onClick={() => setExpandedUsedIdeasPlanId((current) => (current === plan.id ? null : plan.id))}
                >
                  <span>{workspaceText(locale, "Использованные", "Used")}</span>
                  <span>{formatWorkspaceContentPlanIdeaCount(usedIdeas.length, locale)}</span>
                </button>

                {isUsedIdeasExpanded ? (
                  <div className="studio-content-plan__ideas">
                    {usedIdeas.map((idea) => renderIdeaCard(plan, idea))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="studio-content-plan__plan-actions studio-content-plan__plan-actions--footer">
              <button
                className="studio-content-plan__ghost-btn"
                type="button"
                disabled={deletingPlanId === plan.id || isGenerating}
                onClick={() => void onRegeneratePlan(plan)}
              >
                {isGenerating
                  ? workspaceText(locale, "Создаём...", "Creating...")
                  : workspaceText(locale, "Создать еще", "Create more")}
              </button>
              <button
                className="studio-content-plan__ghost-btn is-danger"
                type="button"
                disabled={deletingPlanId === plan.id}
                onClick={() => void onDeletePlan(plan)}
              >
                {deletingPlanId === plan.id
                  ? workspaceText(locale, "Удаляем...", "Deleting...")
                  : workspaceText(locale, "Удалить", "Delete")}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <aside
      ref={panelRef}
      className={`studio-content-plan${isVisible ? " is-visible" : ""}`}
      aria-label={workspaceText(locale, "Контент-план", "Content plan")}
      aria-hidden={!isVisible}
    >
      <div className="studio-content-plan__header">
        <div className="studio-content-plan__copy">
          <strong>{workspaceText(locale, "Контент-план", "Content plan")}</strong>
        </div>
        <button
          className="studio-content-plan__collapse-btn"
          type="button"
          aria-label={workspaceText(locale, "Скрыть контент-план", "Hide content plan")}
          onClick={onToggleVisibility}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>

      <div className="studio-content-plan__composer">
        <div className="studio-content-plan__composer-row">
          <input
            id="studio-content-plan-query"
            className="studio-content-plan__input"
            type="text"
            placeholder={workspaceText(locale, "Введите тему для контент-плана", "Enter a topic for the content plan")}
            value={queryInput}
            onChange={onQueryInputChange}
          />
          <button
            className="studio-content-plan__primary-btn"
            type="button"
            aria-label={workspaceText(locale, "Создать контент-план", "Create content plan")}
            disabled={isGenerating || isLoading}
            onClick={() => void onGenerate()}
          >
            {isGenerating ? (
              <span className="studio-canvas-prompt__btn-spinner" aria-hidden="true"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="studio-content-plan__error">
          <p className="studio-content-plan__notice is-error" role="alert">
            {error}
          </p>
          <button className="studio-content-plan__ghost-btn" type="button" onClick={onRetryLoad}>
            {workspaceText(locale, "Повторить", "Retry")}
          </button>
        </div>
      ) : null}

      <div className="studio-content-plan__body">
        {isLoading ? (
          <div className="studio-content-plan__state">
            <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
            <p>{workspaceText(locale, "Загружаем контент-планы...", "Loading content plans...")}</p>
          </div>
        ) : contentPlans.length === 0 ? (
          <div className="studio-content-plan__state">
            <strong>{workspaceText(locale, "Планов пока нет", "No plans yet")}</strong>
            <p>{workspaceText(locale, "Введите тему и получите готовые идеи для Shorts.", "Enter a topic and get ready-made ideas for Shorts.")}</p>
          </div>
        ) : (
          <section className="studio-content-plan__section">
            <div className="studio-content-plan__plans-list">
              {contentPlans.map((plan) => renderPlanSection(plan))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
