// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LandingPage } from "./LandingPage";

const renderLandingPage = () =>
  render(
    <MemoryRouter>
      <LandingPage
        session={null}
        onOpenSignup={() => undefined}
        onOpenSignin={() => undefined}
        onLogout={() => undefined}
        onOpenWorkspace={() => undefined}
      />
    </MemoryRouter>,
  );

describe("LandingPage guides section", () => {
  it("renders production guide links and keeps them external", () => {
    renderLandingPage();

    const guidesSection = screen.getByRole("region", {
      name: "Полезные материалы привлекают трафик и подводят к продукту.",
    });
    const guideCards = Array.from(guidesSection.querySelectorAll<HTMLAnchorElement>(".guide-card"));

    expect(guideCards).toHaveLength(3);
    expect(guideCards.map((guide) => guide.getAttribute("href"))).toEqual([
      "https://adshortsai.com/shorts-guides/",
      "https://adshortsai.com/kak-sdelat-huk-v-shorts/",
      "https://adshortsai.com/subtitry-dlya-shorts-avtomatom/",
    ]);

    guideCards.forEach((guide) => {
      expect(guide.getAttribute("target")).toBe("_blank");
      expect(guide.getAttribute("rel")).toBe("noopener noreferrer");
    });

    const ctaLink = within(guidesSection).getByRole("link", { name: "Все материалы" });

    expect(ctaLink.getAttribute("href")).toBe("https://adshortsai.com/shorts-guides/");
    expect(ctaLink.getAttribute("target")).toBe("_blank");
    expect(ctaLink.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("uses the original workflow block before the refine block", () => {
    renderLandingPage();

    const workflowSection = screen
      .getByRole("heading", { name: "От идеи до готового Shorts за 3 шага" })
      .closest("section");
    const refineSection = screen
      .getByRole("heading", { name: /Доведите Shorts до идеала/ })
      .closest("section");

    expect(workflowSection?.className).toContain("section--workflow");
    expect(workflowSection?.className).toContain("section--paper");
    expect(refineSection?.className).toContain("section--paper");
  });
});
