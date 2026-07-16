// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceReferenceVisualOption } from "./workspace-prompt-helpers";
import { WorkspaceSegmentVisualReferencesPanel } from "./workspace-references-ui";

const sceneOption: WorkspaceReferenceVisualOption = {
  assetId: 901,
  displayNumber: 1,
  key: "project-scene:scene-1",
  kind: "scene",
  label: "Сцена 1",
  previewKind: "image",
  source: "project-scene",
  sourceProjectId: 77,
  sourceSegmentIndex: 0,
  subtitle: "Из текущего проекта",
};

const renderPanel = (overrides: Partial<Parameters<typeof WorkspaceSegmentVisualReferencesPanel>[0]> = {}) =>
  render(
    <WorkspaceSegmentVisualReferencesPanel
      canRenderModal
      characterPickerIconUrl="/character.png"
      isModalOpen={false}
      isSceneModalOpen={false}
      locale="ru"
      mentionCharacterKeys={[]}
      onInsertMention={vi.fn()}
      onOpen={vi.fn()}
      onOpenScene={vi.fn()}
      onRemoveReference={vi.fn()}
      onRemoveSceneReference={vi.fn()}
      renderModalContent={() => null}
      renderPreview={(option) => <span>{option.label}</span>}
      renderSceneModalContent={() => null}
      sceneReferenceSummary="Сцена 1"
      segmentReferenceSummary="Персонажи: не выбраны"
      selectedCount={0}
      selectedOptions={[]}
      selectedSceneOption={sceneOption}
      {...overrides}
    />,
  );

describe("WorkspaceSegmentVisualReferencesPanel", () => {
  it("places the scene picker next to Characters and shows the selected scene chip", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Выбрать персонажей" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Использовать сцену как референс" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Изменить референс Сцена 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Убрать сцену-референс" })).toBeTruthy();
  });

  it("renders separate character and scene summaries in the generation modal", () => {
    renderPanel({ variant: "modal" });

    expect(screen.getByRole("button", { name: /Персонажи/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Использовать сцену/ })).toBeTruthy();
  });

  it("keeps image editing unchanged when the scene picker is hidden", () => {
    renderPanel({ selectedSceneOption: null, showScenePicker: false });

    expect(screen.queryByText("Использовать сцену")).toBeNull();
  });
});
