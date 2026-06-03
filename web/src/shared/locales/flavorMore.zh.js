/** @type {Record<string, unknown>} */
export default {
  halo: {
    raw: "完全生的", under: "基本没熟", bland: "寡淡如水", burntBad: "严重烧糊",
    burnt: "明显糊了", salty: "过咸难入口", great: "风味出众", good: "味道不错",
    mid: "中规中矩", bad: "需要改进", awful: "难以下咽",
  },
  tags: {
    saltyUmami: "咸鲜", saltyRich: "咸鲜浓郁", saltyHigh: "偏咸",
    sweetSour: "酸甜", sweetHigh: "偏甜", sourSpicy: "酸辣", spicy: "香辣",
    mala: "麻辣", lightUmami: "清淡鲜美", umami: "鲜味突出", aroma: "香气浓郁",
    spicyAroma: "辛香", bitter: "微苦", bitterHigh: "偏苦", char: "焦香",
    burnt: "糊味", oily: "油润", oilyHigh: "浓油", juicy: "多汁", soupy: "汤多",
    wellDone: "全熟", rawish: "偏生", midDone: "适中熟度",
  },
  tasteShort: { sour: "酸", spicy: "辣", aroma: "香", salty: "咸", sweet: "甜", umami: "鲜", bitter: "苦", afterAroma: "回香", afterSweet: "回甘", afterSpicy: "余辣" },
  dish: { empty: "空盘", congee: "白粥", dish: "菜", rice: "饭", soup: "汤", mix: "拌", misc: "杂锦" },
  intro: {
    g90: ["这是少数还算成功的尝试——{dish}做得有模有样。", "难得，这道{dish}确实可以端上桌了。"],
    g70: ["这道{dish}能吃，但也仅限于能吃。", "{dish}还算及格——不过问题也不少。"],
    g50: ["实话实说，这{dish}好几个地方都出了问题。", "{dish}做得不太行，下面细说哪里不对。"],
    g30: ["坦白讲，这个{dish}问题很大，基本翻车了。"],
    g0: ["直接说结论：这{dish}不能吃。"],
    fallback: "这是{dish}。",
  },
  bodyNeutral: ["整体风味中规中矩，是朴实家常的味道。", "味道简单直接，没有太多花哨。", "就是一道实实在在的家常菜。", "简简单单一顿饭，吃着踏实。"],
  suggestLead: "如果说有什么可以提升的——\n",
};
