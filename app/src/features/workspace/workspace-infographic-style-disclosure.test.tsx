/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceInfographicStyleDisclosure } from "./workspace-infographic-style-disclosure";

const renderDisclosure = (value = "", onChange = vi.fn()) => render(
  <WorkspaceInfographicStyleDisclosure
    label="Стиль инфографики — необязательно"
    maxCharacters={3}
    onChange={onChange}
    placeholder="Например: минимализм"
    value={value}
  />,
);

describe("WorkspaceInfographicStyleDisclosure", () => {
  it("is collapsed by default when the optional style is empty", () => {
    const view = renderDisclosure();

    expect(view.container.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("0/3")).toBeTruthy();
  });

  it("opens by default for an existing style and keeps the character limit", () => {
    const onChange = vi.fn();
    const view = renderDisclosure("арт", onChange);

    expect(view.container.querySelector("details")?.hasAttribute("open")).toBe(true);
    fireEvent.change(screen.getByLabelText("Стиль инфографики — необязательно"), {
      target: { value: "абвг" },
    });
    expect(onChange).toHaveBeenCalledWith("абв");
  });
});
