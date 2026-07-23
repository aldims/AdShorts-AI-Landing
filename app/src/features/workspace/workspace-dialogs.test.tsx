// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  WorkspaceScenesCompactWarningModal,
  WorkspaceSegmentEditorBulkSceneSoundModal,
  WorkspaceSegmentEditorDeleteConfirmModal,
  WorkspaceSegmentEditorInfographicDeleteConfirmModal,
} from "./workspace-dialogs";

describe("WorkspaceScenesCompactWarningModal", () => {
  it("recommends the desktop workflow without blocking phone access", () => {
    const onContinue = vi.fn();
    const onReturn = vi.fn();

    render(
      <WorkspaceScenesCompactWarningModal
        isOpen
        locale="ru"
        onContinue={onContinue}
        onReturn={onReturn}
        returnTarget="idea"
      />,
    );

    expect(screen.getByRole("heading", { name: "Удобнее работать на компьютере" })).toBeTruthy();
    expect(screen.getByText("Все инструменты помещаются на одном экране")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Остаться в режиме «Из идеи»" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Всё равно открыть" }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onReturn).not.toHaveBeenCalled();
  });

  it("returns a direct project editor entry to projects", () => {
    const onReturn = vi.fn();

    render(
      <WorkspaceScenesCompactWarningModal
        isOpen
        locale="ru"
        onContinue={() => undefined}
        onReturn={onReturn}
        returnTarget="projects"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Вернуться к проектам" }));
    expect(onReturn).toHaveBeenCalledOnce();
  });
});

function SceneDeleteModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Открыть удаление
      </button>
      <WorkspaceSegmentEditorDeleteConfirmModal
        canDelete
        isBusy={false}
        isOpen={isOpen}
        locale="ru"
        onClose={() => setIsOpen(false)}
        onConfirm={() => undefined}
        segmentSummary="Сцена 1"
      />
    </>
  );
}

describe("WorkspaceSegmentEditorBulkSceneSoundModal", () => {
  it("shows the automatic generation copy and total cost for all scenes", () => {
    render(
      <WorkspaceSegmentEditorBulkSceneSoundModal
        completedCount={0}
        failedCount={0}
        isGenerating={false}
        isOpen
        locale="ru"
        onClose={() => undefined}
        onGenerate={() => undefined}
        sceneCount={5}
        totalCredits={10}
      />,
    );

    expect(screen.getByText("5 сцен · цена зависит от длительности")).toBeTruthy();
    expect(screen.getByText("ИИ подберёт эффекты по визуалу каждой сцены — вводить описание не нужно. Уже добавленные звуки будут заменены.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("starts generation from the paid confirmation action", () => {
    const onGenerate = vi.fn();
    render(
      <WorkspaceSegmentEditorBulkSceneSoundModal
        completedCount={0}
        failedCount={0}
        isGenerating={false}
        isOpen
        locale="ru"
        onClose={() => undefined}
        onGenerate={onGenerate}
        sceneCount={5}
        totalCredits={10}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Создать звуки · 10 ⚡" }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("focuses the dialog panel when generation disables every action", () => {
    render(
      <WorkspaceSegmentEditorBulkSceneSoundModal
        completedCount={1}
        failedCount={0}
        isGenerating
        isOpen
        locale="ru"
        onClose={() => undefined}
        onGenerate={() => undefined}
        sceneCount={5}
        totalCredits={10}
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole("document"));
  });
});

describe("scene dialog focus management", () => {
  it("moves focus into the dialog and returns it to the opener on close", () => {
    render(<SceneDeleteModalHarness />);
    const opener = screen.getByRole("button", { name: "Открыть удаление" });
    opener.focus();

    fireEvent.click(opener);
    const cancelButton = screen.getByRole("button", { name: "Отмена" });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.click(cancelButton);
    expect(document.activeElement).toBe(opener);
  });

  it("keeps forward and backward Tab navigation inside the dialog", () => {
    render(
      <WorkspaceSegmentEditorDeleteConfirmModal
        canDelete
        isBusy={false}
        isOpen
        locale="ru"
        onClose={() => undefined}
        onConfirm={() => undefined}
        segmentSummary="Сцена 1"
      />,
    );

    const panel = screen.getByRole("document");
    const panelButtons = within(panel).getAllByRole("button");
    const firstButton = panelButtons[0]!;
    const lastButton = panelButtons[panelButtons.length - 1]!;

    lastButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(firstButton);

    firstButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);
  });
});

describe("WorkspaceSegmentEditorInfographicDeleteConfirmModal", () => {
  it("shows product copy without a browser confirmation", () => {
    render(
      <WorkspaceSegmentEditorInfographicDeleteConfirmModal
        infographicText="Хочешь больше силы?"
        isOpen
        locale="ru"
        onClose={() => undefined}
        onConfirm={() => undefined}
        segmentNumber={1}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Удалить инфографику?" })).toBeTruthy();
    expect(
      screen.getByText("Слой исчезнет из этой сцены. Кредиты за его создание не возвращаются."),
    ).toBeTruthy();
    expect(screen.getByText("Сцена 1 · «Хочешь больше силы?»")).toBeTruthy();
  });

  it("keeps cancellation and deletion as separate explicit actions", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <WorkspaceSegmentEditorInfographicDeleteConfirmModal
        infographicText="Есть решение!"
        isOpen
        locale="ru"
        onClose={onClose}
        onConfirm={onConfirm}
        segmentNumber={2}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
