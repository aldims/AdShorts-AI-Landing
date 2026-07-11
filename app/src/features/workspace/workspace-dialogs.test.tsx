// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceSegmentEditorBulkSceneSoundModal } from "./workspace-dialogs";

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
