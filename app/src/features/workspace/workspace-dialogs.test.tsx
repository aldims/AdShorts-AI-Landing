// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WorkspaceSegmentEditorBulkSceneSoundModal,
  WorkspaceSegmentEditorInfographicDeleteConfirmModal,
} from "./workspace-dialogs";

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
