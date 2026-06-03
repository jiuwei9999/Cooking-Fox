/** @type {Record<string, unknown>} */
export default {
  scoreOutOf: "/ 100 pts",
  donenessHint: "Each portion has its own doneness bar (demo):",
  donenessDemo: { raw: "Raw", under: "Under", mid: "Medium", done: "Done" },
  marinate: {
    s1t: "① Main", s1d: "Pick from library · Add to bowl",
    s2t: "② Brine", s2d: "Soy, wine, etc.",
    s3t: "③ Time", s3d: "5 / 15 / 30 / 60 min",
    s4t: "④ Start", s4d: "Scoop when timer ends",
  },
  kitchen: {
    wok: "Wok ▾", prep: "Prep", lab: "RecipeLab",
    ingLib: "① Library", search: "🔍 Search…",
    tabs: ["All", "This dish", "Meat"],
    egg: "🥚 Egg", eggAmt: "+50g", tomato: "🍅 Tomato",
    listItem: "🍅 Tomato · 32% done", scoop: "🥢 Scoop",
    pot: "② 3D pot", temp: "168°C",
    ctrl: "③ Controls", target: "🎯 Tomato & egg · next step",
    heat: "🔥 Heat", serve: "Serve report",
  },
  prep: {
    ing: "Ingredients", ingBox: "Search · target guide",
    board: "Board / bowl", boardBox: "Peel · chop",
    reserve: "🥢 Set aside", reserveBox: "Handoff",
    tab: "Tab", tabBox: "Board / marinate / seasoning",
  },
  actions: {
    thOp: "Control", thRole: "What it does", thWhere: "Where",
    rows: [
      ["Add to pot", "Add by grams (starts raw).", "Right panel"],
      ["🔥 Start heating", "Heat to target; tap again to stop.", "Controls"],
      ["Taste", "Salt, sour, spice, etc.", "Before serve"],
      ["Serve report", "Score, radar, review, dish image.", "End of run"],
      ["Prep station", "Full-screen prep overlay.", "Top bar"],
      ["Scoop / return", "Set aside ↔ pot; state kept.", "Left list"],
      ["Clear pot", "Remove all in pot.", "Pot header"],
    ],
  },
  donenessTable: {
    thStage: "Stage", thPct: "%", thMean: "Meaning", thTip: "Tip",
    rows: [
      ["Raw", "0–8%", "🥶", "Just added", "Keep heating"],
      ["Under", "8–22%", "🟢", "Very raw", "Raise heat"],
      ["Medium", "22–52%", "🟡", "Half done", "By ingredient"],
      ["Done", "52–82%", "🟤", "Edible", "Can serve"],
      ["Over", "82%+", "🍳", "Soft/mushy", "Watch heat"],
    ],
  },
};
