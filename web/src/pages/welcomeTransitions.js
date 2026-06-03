import { t } from "../shared/i18n.js";

/** 首页各章节转场：滚动进入 + 侧栏锚点平滑滚动 */
export const CHAPTER_TX = {
  hero: "hero",
  evaluation: "curtain",
  experience: "slide",
  quickstart: "cascade",
  paths: "split",
  tutorial: "unfold",
  kitchen: "zoom",
  actions: "skew",
  prep: "layers",
  doneness: "heat",
  recipe: "flip",
  faq: "stagger",
  footer: "glow",
};

function chapterLabel(id) {
  return t("chapter." + id) || id;
}

export function wrapChapter(id, children) {
  const tx = CHAPTER_TX[id] || "fade";
  const label = chapterLabel(id);
  const article = document.createElement("article");
  article.className = "guideChapter";
  article.id = id;
  article.setAttribute("data-tx", tx);

  const overlay = document.createElement("div");
  overlay.className = "guideTxOverlay";
  overlay.setAttribute("aria-hidden", "true");

  const divider = document.createElement("div");
  divider.className = "guideTxDivider";
  divider.innerHTML =
    '<span class="guideTxDividerGlow"></span>' +
    '<span class="guideTxDividerNum"></span>' +
    '<span class="guideTxDividerLabel">' + label + "</span>" +
    '<span class="guideTxDividerLine"></span>';

  const inner = document.createElement("div");
  inner.className = "guideChapterInner";
  const list = Array.isArray(children) ? children : [children];
  list.forEach((c) => {
    if (c) inner.appendChild(c);
  });

  article.appendChild(overlay);
  article.appendChild(divider);
  article.appendChild(inner);
  return article;
}

function runWipe(chapter) {
  const wipe = chapter.querySelector(".guideTxOverlay");
  if (!wipe) return;
  wipe.classList.remove("tx-wipe-run");
  void wipe.offsetWidth;
  wipe.classList.add("tx-wipe-run");
  const onEnd = () => {
    wipe.classList.remove("tx-wipe-run");
    wipe.removeEventListener("animationend", onEnd);
  };
  wipe.addEventListener("animationend", onEnd);
}

function animateChapterChildren(chapter) {
  const tx = chapter.getAttribute("data-tx");
  const inner = chapter.querySelector(".guideChapterInner");
  if (!inner) return;

  if (tx === "cascade") {
    inner.querySelectorAll(".guideQsStep").forEach((step, i) => {
      step.style.animationDelay = i * 0.1 + "s";
      step.classList.add("tx-child-run");
    });
  }
  if (tx === "stagger") {
    inner.querySelectorAll(".guideFaq, .guideSection").forEach((node, i) => {
      node.style.animationDelay = i * 0.07 + "s";
      node.classList.add("tx-child-run");
    });
  }
  if (tx === "layers") {
    inner.querySelectorAll(".guidePrepCol").forEach((col, i) => {
      col.style.animationDelay = i * 0.12 + "s";
      col.classList.add("tx-child-run");
    });
  }
}

export function setupChapterTransitions(root) {
  const main = root.querySelector(".guideMain");
  if (!main) return;

  const chapters = [...main.querySelectorAll(".guideChapter")];
  if (!chapters.length) return;

  const progressFill = root.querySelector(".guideTxProgressFill");
  const progressDots = root.querySelector(".guideTxProgressDots");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (progressDots && !progressDots.childElementCount) {
    chapters.forEach((ch, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "guideTxDot";
      dot.title = chapterLabel(ch.id);
      dot.setAttribute("data-goto", ch.id);
      dot.innerHTML = '<span class="guideTxDotNum">' + (i + 1) + "</span>";
      dot.addEventListener("click", () => scrollToChapter(main, ch, true));
      progressDots.appendChild(dot);
    });
  }

  let activeId = chapters[0]?.id;
  const chapterIndex = new Map(chapters.map((c, i) => [c.id, i]));

  function setActive(chapter) {
    if (!chapter || activeId === chapter.id) return;
    activeId = chapter.id;
    chapters.forEach((c) => {
      c.classList.toggle("tx-is-active", c.id === chapter.id);
      c.classList.toggle("tx-is-past", chapterIndex.get(c.id) < chapterIndex.get(chapter.id));
    });
    root.querySelectorAll(".guideTxDot").forEach((dot) => {
      dot.classList.toggle("tx-dot-active", dot.getAttribute("data-goto") === chapter.id);
    });
    const idx = chapterIndex.get(chapter.id) ?? 0;
    const max = Math.max(chapters.length - 1, 1);
    if (progressFill) {
      progressFill.style.height = (idx / max) * 100 + "%";
    }
  }

  function activateChapter(chapter) {
    if (chapter.classList.contains("tx-played")) {
      setActive(chapter);
      return;
    }
    chapter.classList.add("tx-active", "tx-played");
    setActive(chapter);
    if (!prefersReduced) {
      runWipe(chapter);
      animateChapterChildren(chapter);
    } else {
      chapter.classList.add("tx-reduced");
    }
    chapter.querySelector(".guideScoreRingWrap")?.classList.add("is-visible");
    chapter.querySelectorAll(".guideDimFill[data-width]").forEach((bar) => {
      requestAnimationFrame(() => {
        bar.style.width = bar.getAttribute("data-width");
      });
    });
    const numEl = chapter.querySelector("[data-score-target]");
    if (numEl && chapter.id === "hero") {
      const target = parseInt(numEl.getAttribute("data-score-target"), 10) || 86;
      let cur = 0;
      const tick = () => {
        cur += Math.max(1, Math.round((target - cur) / 7));
        numEl.textContent = cur >= target ? String(target) : String(cur);
        if (cur < target) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    chapter.querySelectorAll(".guideReveal, .guideServePanel, .guideEvalFlowItem, .guideBentoCard").forEach((el, i) => {
      setTimeout(() => el.classList.add("is-visible"), 100 + i * 55);
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      let best = null;
      let bestRatio = 0;
      entries.forEach((entry) => {
        const ch = entry.target;
        const ratio = entry.intersectionRatio;
        ch.style.setProperty("--tx-ratio", String(ratio));
        if (entry.isIntersecting && ratio > bestRatio) {
          bestRatio = ratio;
          best = ch;
        }
        if (entry.isIntersecting && ratio >= 0.18 && !ch.classList.contains("tx-played")) {
          activateChapter(ch);
        }
      });
      if (best && bestRatio >= 0.12) setActive(best);
    },
    { root: main, threshold: [0, 0.08, 0.18, 0.35, 0.55, 0.75, 1], rootMargin: "-12% 0px -12% 0px" },
  );

  chapters.forEach((ch, i) => {
    const numEl = ch.querySelector(".guideTxDividerNum");
    if (numEl) numEl.textContent = String(i + 1).padStart(2, "0");
    io.observe(ch);
  });

  if (prefersReduced) {
    chapters.forEach((ch) => ch.classList.add("tx-active", "tx-played", "tx-reduced"));
  } else {
    const first = chapters.find((c) => c.id === "hero") || chapters[0];
    if (first) activateChapter(first);
  }

  root.querySelectorAll(".guideSidebarLink[href^='#']").forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = (link.getAttribute("href") || "").slice(1);
      const target = root.querySelector("#" + id);
      if (!target || !target.classList.contains("guideChapter")) return;
      e.preventDefault();
      scrollToChapter(main, target, true);
    });
  });
}

function scrollToChapter(main, target, flash) {
  if (flash) {
    main.classList.add("guideMain--tx-jump");
    setTimeout(() => main.classList.remove("guideMain--tx-jump"), 720);
  }
  const top = target.offsetTop - 12;
  main.scrollTo({ top, behavior: "smooth" });
  if (!target.classList.contains("tx-played")) {
    setTimeout(() => {
      target.classList.add("tx-active", "tx-played");
      runWipe(target);
      animateChapterChildren(target);
    }, 320);
  }
}
