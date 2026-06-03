import { el } from "./dom.js";
import { t } from "./i18n.js";

/** @param {"guide"|"meal"} active */
export function buildSitePageNav(active) {
  return el("nav", { class: "guidePageNav" }, [
    el("a", {
      href: "#/",
      class: "guidePageNavLink" + (active === "guide" ? " guidePageNavLinkActive" : ""),
    }, [t("nav.guide")]),
    el("a", {
      href: "#/meal-plan",
      class: "guidePageNavLink" + (active === "meal" ? " guidePageNavLinkActive" : ""),
    }, [t("nav.mealPlan")]),
  ]);
}
