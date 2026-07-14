// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWorkspaceStudioShortsGenerationStatus } from "./workspace-studio-preview-ui";

afterEach(cleanup);

describe("renderWorkspaceStudioShortsGenerationStatus", () => {
  it("renders the complete Russian generation status", () => {
    const { container } = render(renderWorkspaceStudioShortsGenerationStatus("ru"));

    expect(screen.getByText("AI-рендер в процессе")).toBeTruthy();
    expect(screen.getByText("Создаём ваш Shorts")).toBeTruthy();
    expect(screen.getByText("Собираем сцены, озвучку и субтитры")).toBeTruthy();
    expect(container.querySelector(".studio-generation-visual")).toBeTruthy();
    expect(container.querySelector(".studio-canvas-preview__generation-progress")).toBeTruthy();
  });

  it("keeps the generation status localized in English", () => {
    render(renderWorkspaceStudioShortsGenerationStatus("en"));

    expect(screen.getByText("AI render in progress")).toBeTruthy();
    expect(screen.getByText("Creating your Short")).toBeTruthy();
    expect(screen.getByText("Assembling scenes, voiceover and subtitles")).toBeTruthy();
  });
});
