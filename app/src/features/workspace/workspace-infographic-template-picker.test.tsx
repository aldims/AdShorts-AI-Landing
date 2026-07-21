/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  getWorkspaceInfographicCustomStylePrompt,
  getWorkspaceInfographicTemplateByStylePrompt,
  isWorkspaceInfographicTemplateStylePrompt,
  WORKSPACE_INFOGRAPHIC_TEMPLATES,
  WorkspaceInfographicTemplatePicker,
} from "./workspace-infographic-template-picker";

describe("WorkspaceInfographicTemplatePicker", () => {
  it("shows five localized templates and explains scene color matching", () => {
    render(
      <WorkspaceInfographicTemplatePicker
        locale="ru"
        onChange={vi.fn()}
        value=""
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByText("Подстроится под цвета сцены")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Акцент. Одна сильная мысль" })).toBeTruthy();
    expect(document.querySelectorAll(".studio-infographic-template__preview img")).toHaveLength(5);
    expect(document.querySelector<HTMLImageElement>('[data-template="focus"] img')?.src).toContain(
      "/infographic-templates/focus.png",
    );
  });

  it("applies the selected template prompt and restores its selected state", () => {
    const onChange = vi.fn();
    const selectedTemplate = WORKSPACE_INFOGRAPHIC_TEMPLATES[2];
    const view = render(
      <WorkspaceInfographicTemplatePicker
        locale="en"
        onChange={onChange}
        value={selectedTemplate.stylePrompt}
      />,
    );

    expect(screen.getByRole("button", { name: "Steps. A sequence in order" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Cards. Several key points" }));
    expect(onChange).toHaveBeenCalledWith(WORKSPACE_INFOGRAPHIC_TEMPLATES[3].stylePrompt);
    expect(getWorkspaceInfographicTemplateByStylePrompt(selectedTemplate.stylePrompt)?.id).toBe("steps");
    expect(isWorkspaceInfographicTemplateStylePrompt("custom style")).toBe(false);
    view.unmount();
  });

  it("keeps every generation prompt within the API limit and tied to the source scene", () => {
    WORKSPACE_INFOGRAPHIC_TEMPLATES.forEach((template) => {
      expect(Array.from(template.stylePrompt).length).toBeLessThanOrEqual(300);
      expect(template.stylePrompt).toContain("source scene");
      expect(template.stylePrompt).toContain("supplied text");
      expect(template.imageSrc).toBe(`/infographic-templates/${template.id}.png`);
    });
  });

  it("removes a stored template prompt while template selection is unavailable", () => {
    expect(getWorkspaceInfographicCustomStylePrompt(WORKSPACE_INFOGRAPHIC_TEMPLATES[0].stylePrompt)).toBe("");
    expect(getWorkspaceInfographicCustomStylePrompt("custom minimal style")).toBe("custom minimal style");
  });
});
