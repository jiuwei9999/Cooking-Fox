/** @type {Record<string, unknown>} */
export default {
  halo: {
    raw: "Completely raw", under: "Mostly raw", bland: "Like water", burntBad: "Burnt badly",
    burnt: "Clearly burnt", salty: "Too salty", great: "Outstanding", good: "Tasty",
    mid: "Average", bad: "Needs work", awful: "Hard to eat",
  },
  tags: {
    saltyUmami: "Savory", saltyRich: "Rich savory", saltyHigh: "Too salty",
    sweetSour: "Sweet-sour", sweetHigh: "Too sweet", sourSpicy: "Sour-spicy", spicy: "Spicy",
    mala: "Numbing-spicy", lightUmami: "Light umami", umami: "Umami-forward", aroma: "Aromatic",
    spicyAroma: "Spiced aroma", bitter: "Slight bitter", bitterHigh: "Bitter", char: "Charred aroma",
    burnt: "Burnt", oily: "Oily", oilyHigh: "Very oily", juicy: "Juicy", soupy: "Brothy",
    wellDone: "Well done", rawish: "Underdone", midDone: "Medium doneness",
  },
  tasteShort: { sour: "Sour", spicy: "Spicy", aroma: "Aroma", salty: "Salt", sweet: "Sweet", umami: "Umami", bitter: "Bitter", afterAroma: "Finish aroma", afterSweet: "Sweet finish", afterSpicy: "Lingering heat" },
  dish: { empty: "Empty plate", congee: "Congee", dish: "dish", rice: "rice", soup: "soup", mix: "with", misc: "medley" },
  intro: {
    g90: ["A rare win—{dish} actually works.", "Finally, {dish} you can serve."],
    g70: ["{dish} is edible—barely.", "{dish} passes—but issues remain."],
    g50: ["Honestly {dish} has several problems.", "{dish} needs work—details below."],
    g30: ["{dish} is a near disaster."],
    g0: ["Bottom line: don’t eat this {dish}."],
    fallback: "This is {dish}.",
  },
  bodyNeutral: ["Straightforward home cooking.", "Simple, no frills.", "Honest everyday food.", "Comfort food, nothing fancy."],
  suggestLead: "To improve:\n",
};
