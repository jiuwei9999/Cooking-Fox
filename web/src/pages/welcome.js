import { el, mount } from "../shared/dom.js";
import { t, tr, createLangToggle } from "../shared/i18n.js";
import { buildSitePageNav } from "../shared/sitePageNav.js";
import { wrapChapter, setupChapterTransitions } from "./welcomeTransitions.js";

const tw = (k, params) => t("welcome." + k, params);

function buildNav() {
  return [
    { id: "evaluation", label: t("nav.evaluation"), icon: "⭐", group: "main" },
    { id: "experience", label: t("nav.experience"), icon: "🎭", group: "main" },
    { id: "quickstart", label: t("nav.quickstart"), icon: "⚡", group: "main" },
    { id: "_divider", label: t("nav.newbieDivider"), group: "divider" },
    { id: "paths", label: t("nav.paths"), icon: "🧭", group: "newbie" },
    { id: "tutorial", label: t("nav.tutorial"), icon: "🍅", group: "newbie" },
    { id: "kitchen", label: t("nav.kitchen"), icon: "🍳", group: "newbie" },
    { id: "actions", label: t("nav.actions"), icon: "🎛️", group: "newbie" },
    { id: "prep", label: t("nav.prep"), icon: "🔪", group: "newbie" },
    { id: "doneness", label: t("nav.doneness"), icon: "🌡️", group: "newbie" },
    { id: "recipe", label: t("nav.recipe"), icon: "📖", group: "newbie" },
    { id: "faq", label: t("nav.faq"), icon: "❓", group: "newbie" },
  ];
}

function getJudgeDims() {
  return [
    { name: t("judge.salt"), score: 17, max: 20, cls: "hi" },
    { name: t("judge.heat"), score: 16, max: 20, cls: "hi" },
    { name: t("judge.compat"), score: 12, max: 15, cls: "mid" },
    { name: t("judge.texture"), score: 8, max: 10, cls: "mid" },
    { name: t("judge.appear"), score: 4, max: 5, cls: "hi" },
  ];
}

function getThemeIcon() {
  return (document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme")) === "light"
    ? "🌙" : "☀️";
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme");
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("cookingsim.theme", next);
  document.querySelectorAll("[data-welcome-theme]").forEach((btn) => {
    btn.textContent = getThemeIcon();
  });
}

function section(title, subtitle, bodyChildren) {
  return el("section", { class: "guideSection" }, [
    el("div", { class: "guideSectionHead" }, [
      el("h2", { class: "guideSectionTitle" }, [title]),
      subtitle ? el("p", { class: "guideSectionSub" }, [subtitle]) : null,
    ].filter(Boolean)),
    el("div", { class: "guideSectionBody" }, bodyChildren),
  ]);
}

function scene(sceneClass, tag, title, subtitle, bodyChildren) {
  return el("div", { class: "guideScene " + sceneClass }, [
    el("div", { class: "guideSceneHead" }, [
      el("span", { class: "guideSceneTag" }, [tag]),
      el("h2", { class: "guideSceneTitle" }, [title]),
      el("p", { class: "guideSceneSub" }, [subtitle]),
    ]),
    el("div", { class: "guideSceneBody" }, bodyChildren),
  ]);
}

function callout(type, title, text) {
  return el("div", { class: "guideCallout guideCallout-" + type + " guideReveal", "data-delay": "1" }, [
    el("strong", { class: "guideCalloutTitle" }, [title]),
    el("p", { class: "guideCalloutText" }, [text]),
  ]);
}

function stepRow(num, title, desc, extra) {
  return el("div", { class: "guideStep guideReveal", "data-delay": String((num % 4) + 1) }, [
    el("div", { class: "guideStepNum" }, [num]),
    el("div", { class: "guideStepContent" }, [
      el("h4", { class: "guideStepTitle" }, [title]),
      el("p", { class: "guideStepDesc" }, [desc]),
      extra || null,
    ].filter(Boolean)),
  ]);
}

function buildHeroCinematic() {
  const ringWrap = el("div", { class: "guideScoreRingWrap guideReveal" }, [
    el("svg", { class: "guideScoreRingSvg", viewBox: "0 0 180 180" }, [
      el("defs", {}, [
        el("linearGradient", { id: "guideScoreGrad", x1: "0%", y1: "0%", x2: "100%", y2: "100%" }, [
          el("stop", { offset: "0%", "stop-color": "#ffd93d" }, []),
          el("stop", { offset: "50%", "stop-color": "#ff6b6b" }, []),
          el("stop", { offset: "100%", "stop-color": "#6bcb77" }, []),
        ]),
      ]),
      el("circle", { class: "guideScoreRingTrack", cx: "90", cy: "90", r: "80" }, []),
      el("circle", { class: "guideScoreRingFill", cx: "90", cy: "90", r: "80" }, []),
    ]),
    el("div", { class: "guideScoreRingCenter" }, [
      el("span", { class: "guideScoreRingNum", "data-score-target": "86" }, ["0"]),
      el("span", { class: "guideScoreRingLabel" }, [t("welcomeMock.scoreOutOf")]),
    ]),
    el("div", { class: "guideScoreRingComment" }, [tw("scoreComment")]),
  ]);

  return el("div", { class: "guideHeroCinematic" }, [
    el("div", { class: "guideHeroGrid" }, [
      el("div", {}, [
        el("span", { class: "guideHeroBadge" }, [tw("heroBadge")]),
        el("h1", { class: "guideHeroTitleXL" }, [tw("heroTitle1"), el("br", {}, []), tw("heroTitle2")]),
        el("p", { class: "guideHeroLead" }, [tw("heroLead")]),
        el("div", { class: "guideHeroPills" }, [
          el("span", { class: "guidePill" }, [tw("pill1")]),
          el("span", { class: "guidePill" }, [tw("pill2")]),
          el("span", { class: "guidePill" }, [tw("pill3")]),
          el("span", { class: "guidePill" }, [tw("pill4")]),
        ]),
        el("div", { class: "guideHeroCta" }, [
          el("a", { href: "#/kitchen", class: "btn btnPrimary" }, [tw("ctaCook")]),
          el("a", { href: "#evaluation", class: "btn btnSuccess" }, [tw("ctaEval")]),
          el("a", { href: "#quickstart", class: "btn" }, [tw("ctaQuick")]),
          el("a", { href: "#/meal-plan", class: "btn btnSuccess" }, [tw("mealPlanCta")]),
        ]),
      ]),
      el("div", { class: "guideHeroOrbWrap" }, [
        el("div", { class: "guideHeroOrb guideHeroOrb1" }, []),
        el("div", { class: "guideHeroOrb guideHeroOrb2" }, []),
        ringWrap,
      ]),
    ]),
  ]);
}

function buildEvalFlow() {
  const items = [
    [tw("evalFlow1t"), tw("evalFlow1d")],
    [tw("evalFlow2t"), tw("evalFlow2d")],
    [tw("evalFlow3t"), tw("evalFlow3d")],
    [tw("evalFlow4t"), tw("evalFlow4d")],
  ];
  return el("div", { class: "guideEvalFlow" }, items.map((it, i) =>
    el("div", {
      class: "guideEvalFlowItem guideReveal",
      "data-delay": String(i + 1),
    }, [el("strong", {}, [it[0]]), it[1]])
  ));
}

function buildServeMockup() {
  const dimRows = getJudgeDims().map((d) => {
    const pct = Math.round((d.score / d.max) * 100);
    return el("div", { class: "guideDimRow" }, [
      el("span", {}, [d.name]),
      el("div", { class: "guideDimTrack" }, [
        el("div", {
          class: "guideDimFill guideDimFill--" + (d.cls === "hi" ? "hi" : d.cls === "mid" ? "mid" : "lo"),
          "data-width": pct + "%",
        }, []),
      ]),
      el("span", {}, [d.score + "/" + d.max]),
    ]);
  });

  const radarSvg = el("svg", { class: "guideRadarSpin", viewBox: "0 0 120 120" }, [
    el("polygon", {
      class: "guideRadarPoly",
      points: "60,15 95,45 85,95 35,95 25,45",
    }, []),
    el("circle", { cx: "60", cy: "60", r: "48", fill: "none", stroke: "rgba(255,255,255,0.08)", "stroke-width": "1" }, []),
  ]);

  return el("div", { class: "guideServeStage" }, [
    el("div", { class: "guideServePanel guideReveal", "data-delay": "1" }, [
      el("div", { class: "guideServePanelHead" }, [tw("mockDishReport"), el("span", { style: "opacity:0.6" }, [tw("mockDiagram")])]),
      el("div", { class: "guideServeDish" }, ["🍳"]),
      el("div", { class: "guideServeAiBtn" }, [t("kitchen.aiImage")]),
    ]),
    el("div", { class: "guideServePanel guideReveal", "data-delay": "2" }, [
      el("div", { class: "guideServePanelHead" }, [tw("mockScoreFlavor")]),
      el("div", { class: "guideServeRight" }, [
        el("div", { class: "guideServeStars" }, ["⭐⭐⭐⭐☆"]),
        el("div", { class: "guideRadarBox" }, [radarSvg]),
        el("div", { class: "guideDimList" }, dimRows),
        el("div", { class: "guideServeQuote" }, [
          el("strong", {}, [tw("mockReview")]),
          tw("mockReviewBody"),
        ]),
      ]),
    ]),
  ]);
}

function buildEvaluationSection() {
  return wrapChapter("evaluation", scene(
    "guideScene--evaluation",
    tw("evalTag"),
    tw("evalTitle"),
    tw("evalSub"),
    [
      buildEvalFlow(),
      buildServeMockup(),
      callout("tip", tw("evalTipT"), tw("evalTipD")),
      el("h4", { class: "guideSubTitle" }, [tw("dimTableTitle")]),
      el("table", { class: "guideTable" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", {}, [tw("thDim")]),
            el("th", {}, [tw("thScore")]),
            el("th", {}, [tw("thCheck")]),
          ]),
        ]),
        el("tbody", {}, [
          [t("judge.salt"), "20", "—"],
          [t("judge.oil"), "15", "—"],
          [t("judge.heat"), "20", "—"],
          [t("judge.compat"), "15", "—"],
          [t("judge.season"), "10", "—"],
          [t("judge.texture"), "10", "—"],
          [t("judge.appear"), "5", "—"],
          [t("judge.temp"), "5", "—"],
        ].map((r) => el("tr", {}, [el("td", {}, [el("strong", {}, [r[0]])]), el("td", {}, [r[1]]), el("td", {}, [r[2]])]))),
      ]),
    ],
  ));
}

function buildExperienceSection() {
  const cards = [
    { wide: true, hero: true, icon: "🍳", title: tw("exp1t"), text: tw("exp1d") },
    { icon: "👅", title: tw("exp2t"), text: tw("exp2d") },
    { icon: "⭐", title: tw("exp3t"), text: tw("exp3d") },
    { icon: "📖", title: tw("exp4t"), text: tw("exp4d") },
    { icon: "🤖", title: tw("exp5t"), text: tw("exp5d") },
  ];

  return wrapChapter("experience", scene(
    "guideScene--experience",
    tw("expTag"),
    tw("expTitle"),
    tw("expSub"),
    [
      el("div", { class: "guideBento" }, cards.map((c, i) =>
        el("div", {
          class: "guideBentoCard guideReveal" +
            (c.wide ? " guideBentoCard--wide" : "") +
            (c.hero ? " guideBentoCard--hero" : ""),
          "data-delay": String((i % 4) + 1),
        }, [
          el("span", { class: "guideBentoIcon" }, [c.icon]),
          el("h3", {}, [c.title]),
          el("p", {}, [c.text]),
        ])
      )),
    ],
  ));
}

function buildQuickstart() {
  const steps = [
    { icon: "🥬", label: tw("qs1l"), hint: tw("qs1h") },
    { icon: "👅", label: tw("qs2l"), hint: tw("qs2h") },
    { icon: "⭐", label: tw("qs3l"), hint: tw("qs3h") },
    { icon: "📖", label: tw("qs4l"), hint: tw("qs4h") },
  ];
  return wrapChapter("quickstart", el("div", { class: "guideQuickstart" }, [
    el("h2", { class: "guideQuickstartTitle" }, [tw("qsTitle")]),
    el("p", { class: "guideQuickstartSub" }, [tw("qsSub")]),
    el("div", { class: "guideQuickstartFlow" }, steps.map((s, i) =>
      el("div", { class: "guideQsStep", "data-delay": String(i + 1) }, [
        el("span", { class: "guideQsIcon" }, [s.icon]),
        el("span", { class: "guideQsLabel" }, [s.label]),
        el("span", { class: "guideQsHint" }, [s.hint]),
      ])
    )),
  ]));
}

function buildDonenessDemo() {
  const rows = [
    { label: t("welcomeMock.donenessDemo.raw"), pct: "5%", w: "5%", cls: "guideDonenessRaw" },
    { label: t("welcomeMock.donenessDemo.under"), pct: "18%", w: "18%", cls: "guideDonenessRaw" },
    { label: t("welcomeMock.donenessDemo.mid"), pct: "45%", w: "45%", cls: "guideDonenessMid" },
    { label: t("welcomeMock.donenessDemo.done"), pct: "78%", w: "78%", cls: "guideDonenessDone" },
  ];
  return el("div", { class: "guideDonenessDemo guideReveal" }, [
    el("p", { class: "guidePara", style: "margin:0 0 8px" }, [
      t("welcomeMock.donenessHint"),
    ]),
    ...rows.map((r) =>
      el("div", { class: "guideDonenessRow" }, [
        el("span", {}, [r.label]),
        el("div", { class: "guideDonenessTrack" }, [
          el("div", { class: "guideDonenessFill " + r.cls, style: "width:" + r.w }, []),
        ]),
        el("span", {}, [r.pct]),
      ])
    ),
  ]);
}

function buildMarinateFlow() {
  const parts = [
    [t("welcomeMock.marinate.s1t"), t("welcomeMock.marinate.s1d")],
    [t("welcomeMock.marinate.s2t"), t("welcomeMock.marinate.s2d")],
    [t("welcomeMock.marinate.s3t"), t("welcomeMock.marinate.s3d")],
    [t("welcomeMock.marinate.s4t"), t("welcomeMock.marinate.s4d")],
  ];
  const nodes = [];
  parts.forEach((p, i) => {
    if (i > 0) nodes.push(el("span", { class: "guideMarinateArrow" }, ["→"]));
    nodes.push(el("div", { class: "guideMarinateStep" }, [
      el("strong", {}, [p[0]]),
      p[1],
    ]));
  });
  return el("div", { class: "guideMarinateFlow" }, nodes);
}

function buildKitchenMockup() {
  const k = (key) => t("welcomeMock.kitchen." + key);
  const tabs = tr("welcomeMock.kitchen.tabs");
  return el("div", { class: "guideMock guideMockKitchen guideReveal" }, [
    el("div", { class: "guideMockBar" }, [
      el("span", { class: "guideMockLogo" }, ["🦊 狐闹厨房"]),
      el("span", { class: "guideMockChip" }, [k("wok")]),
      el("span", { class: "guideMockChip guideMockChipAccent" }, [k("prep")]),
      el("span", { class: "guideMockChip" }, [k("lab")]),
    ]),
    el("div", { class: "guideMockGrid" }, [
      el("div", { class: "guideMockPanel guideMockPanelLeft" }, [
        el("span", { class: "guideAnnot guideAnnot1" }, [k("ingLib")]),
        el("div", { class: "guideMockSearch" }, [k("search")]),
        el("div", { class: "guideMockTabs" }, Array.isArray(tabs) ? tabs : []),
        el("div", { class: "guideMockCards" }, [
          el("div", { class: "guideMockIng guideMockIngSel" }, [k("egg"), k("eggAmt")]),
          el("div", { class: "guideMockIng" }, [k("tomato")]),
        ]),
        el("div", { class: "guideMockListItem" }, [k("listItem"), k("scoop")]),
      ]),
      el("div", { class: "guideMockPanel guideMockPanelCenter" }, [
        el("span", { class: "guideAnnot guideAnnot2" }, [k("pot")]),
        el("div", { class: "guideMockPot" }, [
          el("div", { class: "guideMockPotInner" }, [
            el("span", { class: "guideMockPotEmoji" }, ["🍳"]),
            el("span", { class: "guideMockPotTemp" }, [k("temp")]),
          ]),
          el("div", { class: "guideMockFlame" }, ["🔥"]),
        ]),
      ]),
      el("div", { class: "guideMockPanel guideMockPanelRight" }, [
        el("span", { class: "guideAnnot guideAnnot3" }, [k("ctrl")]),
        el("div", { class: "guideMockTarget" }, [k("target")]),
        el("div", { class: "guideMockBtns" }, [
          el("span", { class: "guideMockBtn guideMockBtnFire" }, [k("heat")]),
          el("span", { class: "guideMockBtn guideMockBtnPrimary" }, [k("serve")]),
        ]),
      ]),
    ]),
  ]);
}

function buildPrepMockup() {
  const p = (key) => t("welcomeMock.prep." + key);
  return el("div", { class: "guideMock guideMockPrep guideReveal" }, [
    el("div", { class: "guidePrepRow" }, [
      el("div", { class: "guidePrepCol" }, [
        el("span", { class: "guidePrepTag" }, [p("ing")]),
        el("div", { class: "guidePrepBox" }, [p("ingBox")]),
      ]),
      el("div", { class: "guidePrepCol guidePrepColBoard" }, [
        el("span", { class: "guidePrepTag" }, [p("board")]),
        el("div", { class: "guidePrepBox guidePrepBoxLarge" }, [p("boardBox")]),
      ]),
      el("div", { class: "guidePrepCol guidePrepColReserve" }, [
        el("span", { class: "guidePrepTag guidePrepTagGold" }, [p("reserve")]),
        el("div", { class: "guidePrepBox" }, [p("reserveBox")]),
      ]),
      el("div", { class: "guidePrepCol" }, [
        el("span", { class: "guidePrepTag" }, [p("tab")]),
        el("div", { class: "guidePrepBox" }, [p("tabBox")]),
      ]),
    ]),
  ]);
}

function buildActionTable() {
  const rows = tr("welcomeMock.actions.rows") || [];
  return el("table", { class: "guideTable" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, [t("welcomeMock.actions.thOp")]),
        el("th", {}, [t("welcomeMock.actions.thRole")]),
        el("th", {}, [t("welcomeMock.actions.thWhere")]),
      ]),
    ]),
    el("tbody", {}, rows.map((r) =>
      el("tr", {}, [
        el("td", {}, [el("strong", {}, [r[0]])]),
        el("td", {}, [r[1]]),
        el("td", {}, [r[2]]),
      ])
    )),
  ]);
}

function buildDonenessTable() {
  const levels = tr("welcomeMock.donenessTable.rows") || [];
  return el("table", { class: "guideTable guideTableDoneness" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, [t("welcomeMock.donenessTable.thStage")]),
        el("th", {}, [t("welcomeMock.donenessTable.thPct")]),
        el("th", {}, [""]),
        el("th", {}, [t("welcomeMock.donenessTable.thMean")]),
        el("th", {}, [t("welcomeMock.donenessTable.thTip")]),
      ]),
    ]),
    el("tbody", {}, levels.map((r) =>
      el("tr", {}, r.map((c, i) =>
        el("td", {}, i === 2 ? [el("span", { class: "guideTableEmoji" }, [c])] : [c])
      ))
    )),
  ]);
}

function buildFaqItem(q, a) {
  return el("details", { class: "guideFaq guideReveal" }, [
    el("summary", { class: "guideFaqQ" }, [q]),
    el("div", { class: "guideFaqA" }, [a]),
  ]);
}

function buildSidebarNav() {
  const nodes = [];
  buildNav().forEach((n) => {
    if (n.group === "divider") {
      nodes.push(el("div", { class: "guideSidebarDivider" }, [n.label]));
      return;
    }
    nodes.push(el("a", { href: "#" + n.id, class: "guideSidebarLink" }, [
      el("span", { class: "guideSidebarIcon" }, [n.icon]),
      n.label,
    ]));
  });
  return nodes;
}

function setupScrollSpy(root) {
  const links = root.querySelectorAll(".guideSidebarLink");
  const ids = buildNav().filter((n) => n.group !== "divider").map((n) => n.id);
  const sections = ids.map((id) => root.querySelector(".guideChapter#" + id)).filter(Boolean);
  const main = root.querySelector(".guideMain");
  if (!main || !sections.length) return;

  const onScroll = () => {
    const top = main.scrollTop + 100;
    let active = sections[0].id;
    for (const sec of sections) {
      if (sec.offsetTop <= top) active = sec.id;
    }
    links.forEach((a) => {
      a.classList.toggle("guideSidebarLinkActive", a.getAttribute("href") === "#" + active);
    });
  };
  main.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setupInnerReveals(root) {
  const main = root.querySelector(".guideMain");
  if (!main) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { root: main, threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
  );
  root.querySelectorAll(".guideReveal, .guideServePanel, .guideEvalFlowItem, .guideBentoCard").forEach((node) => {
    io.observe(node);
  });
}

export function renderWelcome(root) {
  root.innerHTML = "";
  root.className = "welcomeRoot";

  const sidebar = el("aside", { class: "guideSidebar guideReveal" }, [
    el("a", { href: "#/", class: "guideSidebarLogo" }, ["🦊", el("span", {}, ["狐闹厨房"])]),
    buildSitePageNav("guide"),
    el("p", { class: "guideSidebarHint" }, [tw("sidebarHint")]),
    el("nav", { class: "guideSidebarNav" }, buildSidebarNav()),
    el("div", { class: "guideSidebarCta" }, [
      el("a", { href: "#/meal-plan", class: "btn btnSuccess", style: "width:100%;text-align:center" }, [tw("mealPlanCta")]),
      el("a", { href: "#/kitchen", class: "btn btnPrimary", style: "width:100%;text-align:center;margin-top:8px" }, ["🍳 ", tw("ctaCook")]),
      el("a", { href: "#/recipes", class: "btn", style: "width:100%;text-align:center;margin-top:8px" }, ["📖 ", t("nav.recipeLab")]),
    ]),
  ]);

  const newbieBanner = el("div", { class: "guideNewbieBanner" }, [
    el("div", { class: "guideNewbieBannerLine" }, []),
    el("h2", {}, [tw("newbieBanner")]),
    el("div", { class: "guideNewbieBannerLine" }, []),
  ]);

  const chapterPaths = wrapChapter("paths", [
    newbieBanner,
    section(tw("pathsTitle"), tw("pathsSub"), [
      el("div", { class: "guidePathGrid" }, [
        el("div", { class: "guidePathCard guidePathCardPrimary guideReveal", "data-delay": "1" }, [
          el("span", { class: "guidePathBadge" }, [tw("pathABadge")]),
          el("h3", {}, [tw("pathAT")]),
          el("ol", { class: "guidePathSteps" }, [
            el("li", {}, [tw("pathA1")]),
            el("li", {}, [tw("pathA2")]),
            el("li", {}, [tw("pathA3")]),
          ]),
          el("a", { href: "#/recipes", class: "btn btnSuccess" }, [tw("pathAGo")]),
        ]),
        el("div", { class: "guidePathCard guideReveal", "data-delay": "2" }, [
          el("span", { class: "guidePathBadge" }, [tw("pathBBadge")]),
          el("h3", {}, [tw("pathBT")]),
          el("ol", { class: "guidePathSteps" }, [
            el("li", {}, [tw("pathB1")]),
            el("li", {}, [tw("pathB2")]),
            el("li", {}, [tw("pathB3")]),
          ]),
          el("a", { href: "#/kitchen", class: "btn btnPrimary" }, [tw("pathBGo")]),
        ]),
      ]),
    ]),
  ]);

  const chapterTutorial = wrapChapter("tutorial", section(
      tw("tutTitle"),
      tw("tutSub"),
      [
        callout("tip", tw("tutTipT"), tw("tutTipD")),
        el("div", { class: "guideTutorialFlow" }, [
          stepRow("1", tw("tut1t"), tw("tut1d"), null),
          stepRow("2", tw("tut2t"), tw("tut2d"), buildPrepMockup()),
          stepRow("3", tw("tut3t"), tw("tut3d"), null),
          stepRow("4", tw("tut4t"), tw("tut4d"), null),
          stepRow("5", tw("tut5t"), tw("tut5d"), null),
        ]),
      ],
  ));

  const chapterKitchen = wrapChapter("kitchen", section(tw("kitchenTitle"), tw("kitchenSub"), [buildKitchenMockup()]));
  const chapterActions = wrapChapter("actions", section(tw("actionsTitle"), tw("actionsSub"), [buildActionTable()]));

  const chapterPrep = wrapChapter("prep", section(tw("prepTitle"), tw("prepSub"), [
      buildPrepMockup(),
      buildMarinateFlow(),
      callout("warn", tw("prepWarnT"), tw("prepWarnD")),
    ]));

  const chapterDoneness = wrapChapter("doneness", section(tw("donenessTitle"), tw("donenessSub"), [
      callout("important", tw("donenessImpT"), tw("donenessImpD")),
      buildDonenessDemo(),
      buildDonenessTable(),
    ]));

  const chapterRecipe = wrapChapter("recipe", section(tw("recipeTitle"), tw("recipeSub"), [
      el("p", { class: "guidePara" }, [tw("recipeP")]),
      el("a", { href: "#/recipes", class: "btn btnSuccess" }, [tw("recipeGo")]),
    ]));

  const chapterFaq = wrapChapter("faq", section(tw("faqTitle"), "", [
      buildFaqItem(tw("faq1q"), tw("faq1a")),
      buildFaqItem(tw("faq2q"), tw("faq2a")),
      buildFaqItem(tw("faq3q"), tw("faq3a")),
      buildFaqItem(tw("faq4q"), tw("faq4a")),
      buildFaqItem(tw("faq5q"), tw("faq5a")),
      buildFaqItem(tw("faq6q"), tw("faq6a")),
    ]));

  const main = el("main", { class: "guideMain" }, [
    el("div", { class: "guideTxProgress", "aria-hidden": "true" }, [
      el("div", { class: "guideTxProgressTrack" }, [
        el("div", { class: "guideTxProgressFill" }, []),
      ]),
      el("div", { class: "guideTxProgressDots" }, []),
    ]),
    el("header", { class: "guideTopBar" }, [
      el("span", { class: "guideTopBarTitle" }, [tw("topTitle")]),
      el("div", { class: "guideTopBarActions" }, [
        createLangToggle({ style: "padding:9px 12px;font-weight:600;min-width:44px" }),
        el("button", {
          type: "button",
          class: "btn",
          "data-welcome-theme": "1",
          onclick: toggleTheme,
        }, [getThemeIcon()]),
        el("a", { href: "#/kitchen", class: "btn btnPrimary" }, [t("nav.enterKitchen"), " →"]),
      ]),
    ]),

    wrapChapter("hero", buildHeroCinematic()),
    buildEvaluationSection(),
    buildExperienceSection(),
    buildQuickstart(),
    chapterPaths,
    chapterTutorial,
    chapterKitchen,
    chapterActions,
    chapterPrep,
    chapterDoneness,
    chapterRecipe,
    chapterFaq,

    wrapChapter("footer", el("footer", { class: "guideFooter" }, [
      el("h2", {}, [tw("footerTitle")]),
      el("p", {}, [tw("footerP")]),
      el("div", { class: "guideFooterBtns" }, [
        el("a", { href: "#/kitchen", class: "btn btnPrimary guideFooterBtn" }, ["🍳 ", tw("ctaCook")]),
        el("a", { href: "#/meal-plan", class: "btn btnSuccess guideFooterBtn" }, [tw("mealPlanCta")]),
        el("a", { href: "#evaluation", class: "btn guideFooterBtn" }, [tw("footerEval")]),
      ]),
    ])),
  ]);

  const layout = el("div", { class: "guideLayout" }, [sidebar, main]);
  mount(root, layout);
  requestAnimationFrame(() => {
    setupScrollSpy(layout);
    setupChapterTransitions(layout);
    setupInnerReveals(layout);
    layout.querySelector(".guideSidebar")?.classList.add("is-visible");
  });
}
