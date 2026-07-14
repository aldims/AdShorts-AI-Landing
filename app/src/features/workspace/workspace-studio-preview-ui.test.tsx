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
    expect(container.querySelector(".studio-generation-visual")).toBeNull();
    expect(container.querySelector(".studio-canvas-preview__generation-progress")).toBeNull();
    expect(container.querySelector(".studio-canvas-preview__generation-kicker i")).toBeNull();
    const backgroundVideo = container.querySelector<HTMLVideoElement>(".studio-generation-background");
    expect(backgroundVideo?.autoplay).toBe(true);
    expect(backgroundVideo?.loop).toBe(true);
    expect(backgroundVideo?.muted).toBe(true);
    expect(backgroundVideo?.playsInline).toBe(true);
    expect(backgroundVideo?.getAttribute("poster")).toBe("/studio/generation-background-poster.webp");
    expect(backgroundVideo?.querySelector("source")?.getAttribute("src")).toBe(
      "/studio/generation-background.mp4",
    );
  });

  it("keeps the generation status localized in English", () => {
    render(renderWorkspaceStudioShortsGenerationStatus("en"));

    expect(screen.getByText("AI render in progress")).toBeTruthy();
    expect(screen.getByText("Creating your Short")).toBeTruthy();
    expect(screen.getByText("Assembling scenes, voiceover and subtitles")).toBeTruthy();
  });
});
