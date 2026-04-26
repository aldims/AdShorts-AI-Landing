// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LocaleProvider, type Locale } from "../lib/i18n";
import { LandingPage } from "./LandingPage";

const renderLandingPage = (locale: Locale = "ru") =>
  render(
    <MemoryRouter>
      <LocaleProvider locale={locale}>
        <LandingPage
          session={null}
          onOpenSignup={() => undefined}
          onOpenSignin={() => undefined}
          onLogout={() => undefined}
          onOpenWorkspace={() => undefined}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );

describe("LandingPage guides section", () => {
  it("renders the updated hero headline", () => {
    renderLandingPage();

    expect(
      screen.getByRole("heading", {
        name: /Shorts \/ Reels \/ TikTok за\s*1\s*минуту\. В один клик\./,
      }),
    ).toBeTruthy();
  });

  it("renders the English hero and localized internal links", () => {
    renderLandingPage("en");

    expect(
      screen.getByRole("heading", {
        name: /Shorts \/ Reels \/ TikTok in\s*1\s*minute\. In one click\./,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Examples" }).getAttribute("href")).toBe("/en/examples");
    expect(screen.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe("/en/pricing");
  });

  it("syncs the hero preview position with the current scroll on initial render", () => {
    const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 240,
    });

    try {
      const { container } = renderLandingPage();
      const heroPreview = container.querySelector<HTMLElement>(".hero-live-preview__perspective");

      expect(heroPreview).toBeTruthy();
      expect(heroPreview?.style.transform).toContain("translateY(-16px)");
    } finally {
      if (scrollYDescriptor) {
        Object.defineProperty(window, "scrollY", scrollYDescriptor);
      } else {
        Object.defineProperty(window, "scrollY", {
          configurable: true,
          value: 0,
        });
      }
    }
  });

  it("renders production guide links and keeps them external", () => {
    renderLandingPage();

    const guidesSection = screen.getByRole("region", {
      name: "Полезные материалы по созданию Shorts",
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

    expect(workflowSection?.className).toContain("lp-section--workflow");
    expect(refineSection?.className).toContain("section--landing-refine");
    expect(workflowSection).toBeTruthy();
    expect(refineSection).toBeTruthy();

    if (!workflowSection || !refineSection) {
      throw new Error("Expected workflow and refine sections to exist");
    }

    expect(workflowSection.compareDocumentPosition(refineSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
