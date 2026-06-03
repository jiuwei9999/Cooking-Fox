import { t, tPick, tr, getLang } from "./i18n.js";
import { displayIngredientName } from "./ingredientMeta.js";
import { judgeDish, isValidDish } from "./judgeProfile.js";

export function calcFlavorHalo(metrics, taste) {
  var burn = metrics.burn_risk || 0;
  var doneness = metrics.doneness || 0;
  var salty = taste.salty || 0;
  var umami = taste.umami || 0;
  var bitter = taste.bitter || 0;
  var sour = taste.sour || 0;
  var sweet = taste.sweet || 0;
  var spicy = taste.spicy || 0;
  var aroma = taste.aroma || 0;
  var intensity = salty + sweet + sour + spicy + umami + bitter;
  var oil = metrics.oil_g || 0;
  var water = metrics.water_g || 0;
  var totalG = Math.max(1, water + oil + (metrics.solids_g || 0));
  var hasMeat = false; // will be set by caller context, default to false

  // ── Tier 1: Hard veto ──
  var veto = null;
  if (doneness < 0.12) veto = { score: 0.3, emoji: "🤢", label: t("flavor.halo.raw"), color: "#ff4444" };
  else if (doneness < 0.18) veto = { score: 0.6, emoji: "😵", label: t("flavor.halo.under"), color: "#ff6b6b" };
  else if (intensity < 0.1) veto = { score: 0.8, emoji: "😵", label: t("flavor.halo.bland"), color: "#ff6b6b" };
  else if (burn > 0.78) veto = { score: 0.5, emoji: "😵", label: t("flavor.halo.burntBad"), color: "#ff6b6b" };
  else if (burn > 0.65) veto = { score: 1.2, emoji: "😟", label: t("flavor.halo.burnt"), color: "#ff8c42" };
  else if (salty > 0.85) veto = { score: 0.9, emoji: "😵", label: t("flavor.halo.salty"), color: "#ff6b6b" };
  if (veto) return veto;

  // ── Tier 2: Core scoring (0-5 range) ──
  var score = 0;
  // Doneness: peak at 0.5-0.85, poor below 0.25 and above 0.95
  if (doneness > 0.5 && doneness < 0.85) score += 1.8;
  else if (doneness > 0.35) score += 1.2;
  else if (doneness > 0.2) score += 0.5;
  else score += 0.1;
  // Burn penalty
  score -= burn * 2.5;
  // Flavor intensity: need some flavor to be food
  if (intensity > 0.4) score += 2.0;
  else if (intensity > 0.25) score += 1.2;
  else if (intensity > 0.15) score += 0.5;
  else score += 0.1; // nearly tasteless
  // Bitter: bad unless very low
  if (bitter < 0.15) score += 0.5;
  else if (bitter > 0.45) score -= 1.2;
  else if (bitter > 0.25) score -= 0.4;

  // ── Tier 3: Balance bonuses (only if has real flavor) ──
  if (intensity > 0.25) {
    if (salty >= 0.18 && salty <= 0.62) score += 0.6;
    else if (salty > 0.72) score -= 1.2;
    if (umami > 0.15) score += 0.5;
    if (aroma > 0.15) score += 0.4;
    if (sweet > 0.15 || sour > 0.15 || spicy > 0.15) score += 0.3;
    if (burn < 0.15 && bitter < 0.15) score += 0.3;
  }

  // ── Tier 4: Extreme penalties ──
  if (salty > 0.72) score -= 1.0;
  if (bitter > 0.4) score -= 0.8;
  if (burn > 0.45) score -= 1.2;
  if (doneness > 0.95) score -= 0.5;
  if (oil / totalG > 0.5 && intensity < 0.3) score -= 0.5;

  // Clamp and round
  score = Math.max(0.1, Math.min(5, score));

  // ── Mapping ──
  var emoji, label, color;
  if (score >= 4.0)      { emoji = "😋"; label = t("flavor.halo.great"); color = "#6bcb77"; }
  else if (score >= 3.0) { emoji = "🙂"; label = t("flavor.halo.good"); color = "#4d96ff"; }
  else if (score >= 2.0) { emoji = "😐"; label = t("flavor.halo.mid"); color = "#ffd93d"; }
  else if (score >= 1.0) { emoji = "😟"; label = t("flavor.halo.bad"); color = "#ff8c42"; }
  else                   { emoji = "😵"; label = t("flavor.halo.awful"); color = "#ff6b6b"; }

  return { score: score, emoji: emoji, label: label, color: color };
}

export function calcMouthfeel(metrics, pot) {
  var emulsion = metrics.emulsion || 0;
  var oil = metrics.oil_g || 0;
  var water = metrics.water_g || 0;
  var solids = metrics.solids_g || 0;
  var total = Math.max(1, oil + water + solids);
  var ingredientKinds = new Set((pot || []).map(function(p){return p.ingredient_id;})).size;
  // Incorporate taste intensity into richness
  var t = metrics.taste || {};
  var intensity = (t.salty||0) + (t.sweet||0) + (t.sour||0) + (t.spicy||0) + (t.umami||0) + (t.aroma||0);

  return {
    smooth: Math.round(Math.min(100, (emulsion * 80 + (oil / total) * 40))),
    rich: Math.round(Math.min(100, (solids / total) * 120 + intensity * 80)),
    fresh: Math.round(Math.min(100, 100 - (oil / total) * 100)),
    layered: Math.round(Math.min(100, ingredientKinds * 20 + intensity * 25)),
  };
}

export function calcFlavorTags(taste, metrics) {
  const tags = [];
  const { salty, sweet, sour, spicy, umami, bitter, aroma } = taste;
  const oil = metrics.oil_g || 0;
  const water = metrics.water_g || 0;
  const burn = metrics.burn_risk || 0;
  const doneness = metrics.doneness || 0;

  if (salty > 0.3 && umami > 0.35) tags.push(t("flavor.tags.saltyUmami"));
  if (salty > 0.4 && umami > 0.5) tags.push(t("flavor.tags.saltyRich"));
  if (salty > 0.7) tags.push(t("flavor.tags.saltyHigh"));
  if (sweet > 0.25 && sour > 0.15) tags.push(t("flavor.tags.sweetSour"));
  if (sweet > 0.5) tags.push(t("flavor.tags.sweetHigh"));
  if (sour > 0.2 && spicy > 0.2) tags.push(t("flavor.tags.sourSpicy"));
  if (spicy > 0.4) tags.push(t("flavor.tags.spicy"));
  if (spicy > 0.6) tags.push(t("flavor.tags.mala"));
  if (umami > 0.5 && salty < 0.4 && spicy < 0.3) tags.push(t("flavor.tags.lightUmami"));
  if (umami > 0.6) tags.push(t("flavor.tags.umami"));
  if (aroma > 0.5) tags.push(t("flavor.tags.aroma"));
  if (aroma > 0.3 && spicy > 0.2) tags.push(t("flavor.tags.spicyAroma"));
  if (bitter > 0.3) tags.push(t("flavor.tags.bitter"));
  if (bitter > 0.5) tags.push(t("flavor.tags.bitterHigh"));
  if (burn > 0.4) tags.push(t("flavor.tags.char"));
  if (burn > 0.6) tags.push(t("flavor.tags.burnt"));
  if (oil > 30) tags.push(t("flavor.tags.oily"));
  if (oil > 60) tags.push(t("flavor.tags.oilyHigh"));
  if (water > 80) tags.push(t("flavor.tags.juicy"));
  if (water > 150) tags.push(t("flavor.tags.soupy"));
  if (doneness > 0.8) tags.push(t("flavor.tags.wellDone"));
  if (doneness < 0.35) tags.push(t("flavor.tags.rawish"));
  if (doneness > 0.5 && doneness < 0.8) tags.push(t("flavor.tags.midDone"));

  return tags.slice(0, 5);
}

export function calcFlavorLayers(taste) {
  const { salty, sweet, sour, spicy, umami, bitter, aroma } = taste;

  let front = [], middle = [], after = [];

  if (sour > 0.15) front.push({ taste: t("flavor.tasteShort.sour"), emoji: "🍋" });
  if (spicy > 0.15) front.push({ taste: t("flavor.tasteShort.spicy"), emoji: "🌶️" });
  if (aroma > 0.3) front.push({ taste: t("flavor.tasteShort.aroma"), emoji: "🌸" });

  if (salty > 0.15) middle.push({ taste: t("flavor.tasteShort.salty"), emoji: "🫙" });
  if (sweet > 0.15) middle.push({ taste: t("flavor.tasteShort.sweet"), emoji: "🍬" });
  if (umami > 0.2) middle.push({ taste: t("flavor.tasteShort.umami"), emoji: "🍄" });

  if (bitter > 0.1) after.push({ taste: t("flavor.tasteShort.bitter"), emoji: "☕" });
  if (aroma > 0.3) after.push({ taste: t("flavor.tasteShort.afterAroma"), emoji: "🌿" });
  if (umami > 0.4) after.push({ taste: t("flavor.tasteShort.afterSweet"), emoji: "✨" });
  if (spicy > 0.3) after.push({ taste: t("flavor.tasteShort.afterSpicy"), emoji: "🔥" });

  return { front, middle, after };
}

export function getDishName(session) {
  var pot = session.pot || [], ings = session.ingredients || {};
  var counts = {};
  for (var i = 0; i < pot.length; i++) { var id = pot[i].ingredient_id; counts[id] = (counts[id]||0) + (pot[i].amount_g||0); }
  var sorted = Object.entries(counts).sort(function(a,b){return b[1]-a[1];}).map(function(e){return ings[e[0]]?ings[e[0]].name:e[0];});
  if (sorted.length === 0) return t("flavor.dish.empty");

  // Determine cooking method from timeline
  var method = "";
  var timeline = session.timeline || [];
  for (var i = timeline.length-1; i >= 0; i--) {
    var a = timeline[i].action;
    if (a && a.type === "heat" && a.heat_method) { method = a.heat_method; break; }
  }
  var methodCN = method ? t("kitchen.heatMethods." + method) || method : "";

  // Check water content for soup
  var water = session.metrics ? (session.metrics.water_g||0) : 0;
  var totalG = 0;
  for (var i = 0; i < pot.length; i++) totalG += (pot[i].amount_g||0);
  var isSoup = water > 150 && water > totalG * 0.5;

  // Check for rice + water = congee/rice
  var hasRice = counts["rice"] > 0;
  var hasWater = counts["water"] > 0;

  // Filter out seasonings/liquids (don't count in dish name)
  var seasonings = ["salt","sugar","pepper","five_spice","soy_sauce","dark_soy_sauce","vinegar","sesame_oil","oyster_sauce","bean_paste","chicken_powder","sesame","starch","cooking_wine","chili_oil"];
  var liquids = ["water","oil"];
  var mainIngs = sorted.filter(function(s){ return seasonings.indexOf(Object.keys(ings).find(function(k){return ings[k].name===s;})||"")<0 && liquids.indexOf(Object.keys(ings).find(function(k){return ings[k].name===s;})||"")<0; });

  // Simplify: get ingredient names directly
  var names = [];
  for (var i = 0; i < sorted.length; i++) {
    var sid = "";
    for (var k in ings) { if (ings[k].name === sorted[i]) { sid = k; break; } }
    if (seasonings.indexOf(sid) >= 0 || liquids.indexOf(sid) >= 0) continue;
    names.push(sorted[i]);
  }

  if (names.length === 0) {
    if (hasRice && hasWater) return t("flavor.dish.congee");
    if (methodCN) return methodCN + t("flavor.dish.dish");
    return t("flavor.dish.dish");
  }

  // Special patterns
  if (hasRice && names.length <= 2 && methodCN) {
    if (names[0] === "大米(生)") names[0] = "饭";
    return names[0] === "饭" ? (methodCN+"饭") : (names[0]+methodCN+"饭");
  }

  if (isSoup) return names.slice(0, 2).join(getLang() === "en" ? " " : "") + t("flavor.dish.soup");

  if (names.length === 1) {
    if (methodCN) return methodCN + " " + names[0];
    return names[0];
  }

  if (names.length === 2) {
    if (methodCN) return names[0] + " " + methodCN + " " + names[1];
    return names[0] + " " + t("flavor.dish.mix") + " " + names[1];
  }

  var main = names[0], subs = names.slice(1, 3).join(getLang() === "en" ? " " : "");
  if (methodCN) return main + " " + methodCN + " " + subs;
  return main + " " + t("flavor.dish.misc");
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickFromPool(pools) {
  var result = [];
  for (var i = 0; i < pools.length; i++) {
    var pool = pools[i];
    if (pool && pool.length > 0) result.push(pickRandom(pool));
  }
  return result;
}

export function genTasteNarrative(session) {
  // ── Invalid dish check ──
  var validity = isValidDish(session);
  if (!validity.valid) {
    var judge = judgeDish(session);
    return {
      intro: validity.reason,
      body: "",
      suggestText: validity.category === "not_cooked" ? t("judge.invalidSuggest.notCooked") :
                   validity.category === "sauce_only" ? t("judge.invalidSuggest.sauceOnly") :
                   validity.category === "not_a_dish" ? t("judge.invalidSuggest.notADish") :
                   t("judge.invalidSuggest.default"),
      pairing: "",
      scene: "",
      touch: validity.category === "not_cooked" ? t("judge.invalidTouch.notCooked") : t("judge.invalidTouch.default"),
      score: 0,
      emoji: validity.category === "not_cooked" ? "🥶" : "🤷",
      judge: judge,
    };
  }

  var m = session.metrics || {};
  var taste = m.taste || {};
  var pot = session.pot || [];
  var ingredients = session.ingredients || {};

  var halo = calcFlavorHalo(m, taste);
  var mouthfeel = calcMouthfeel(m, pot);
  var tags = calcFlavorTags(taste, m);
  var layers = calcFlavorLayers(taste);

  var dishName = getDishName(session);
  var mainIngs = [];
  var seen = {};
  for (var i = 0; i < pot.length && mainIngs.length < 4; i++) {
    var pid = pot[i].ingredient_id;
    var ing = ingredients[pid];
    var nm = ing ? displayIngredientName(ing) : pid;
    if (!seen[nm]) { seen[nm] = true; mainIngs.push(nm); }
  }

  var judgeScore = judgeDish(session).total;  // 0-100, unified evaluation

  // ── Intro ──
  var intros = [];
  if (judgeScore >= 90) intros = tr("flavor.intro.g90") || [];
  else if (judgeScore >= 70) intros = tr("flavor.intro.g70") || [];
  else if (judgeScore >= 50) intros = tr("flavor.intro.g50") || [];
  else if (judgeScore >= 30) intros = tr("flavor.intro.g30") || [];
  else intros = tr("flavor.intro.g0") || [];
  if (!Array.isArray(intros)) intros = [String(intros)];
  if (judgeScore < 50 && intros.length > 1) intros = [intros[0]];
  var intro = intros.length > 0 ? pickRandom(intros.map((s) => s.replace(/\{dish\}/g, dishName))) : t("flavor.intro.fallback", { dish: dishName });

  // ── Body ──
  var bodyPools = [];
  if (judgeScore < 40) {
    // Problem-focused body for very low scores
    if (m.burn_risk > 0.5) bodyPools.push(["焦糊味非常明显","一股焦苦味完全掩盖了其他味道","烧糊的气味让人没有食欲"]);
    if (m.doneness < 0.2) bodyPools.push(["食材几乎还是生的","基本没怎么加热","吃进嘴里是生的，没法下咽"]);
    if (taste.salty > 0.8) bodyPools.push(["咸得根本没法吃","齁咸，舌头都被咸麻了"]);
    if (taste.bitter > 0.4) bodyPools.push(["挥之不去的苦味让人皱眉","苦味太重了"]);
    var intensity = (taste.salty||0)+(taste.sweet||0)+(taste.sour||0)+(taste.spicy||0)+(taste.umami||0)+(taste.bitter||0);
    if (intensity < 0.15) bodyPools.push(["几乎尝不出任何味道","寡淡得像白水一样","完全没有调味的感觉"]);
    if (bodyPools.length === 0) bodyPools.push(["整体来说不太能接受","这道菜确实不太行"]);
  } else if (judgeScore < 60) {
    // Mixed reviews
    bodyPools.push(mouthfeel.smooth > 40 ? ["口感还过得去，但整体有欠缺"] : ["口感不太理想"]);
    bodyPools.push(mouthfeel.fresh < 30 ? ["感觉有点油腻"] : ["清爽度一般"]);
  } else {
    // Normal positive body text
    if (mouthfeel.smooth > 70) bodyPools.push(["入口嫩滑，口感细腻","嫩滑得像丝绸一样","舌头一抿就化的嫩滑感"]);
    else if (mouthfeel.smooth > 50) bodyPools.push(["口感柔软顺滑","吃在嘴里软软的，很舒服","顺滑的口感让人满足"]);
    else if (mouthfeel.smooth > 30) bodyPools.push(["口感适中，不糙不滑刚刚好"]);
    if (mouthfeel.rich > 70) bodyPools.push(["味道浓郁厚重，很有满足感","浓香四溢，一口下去很扎实","味重料足，吃得很过瘾"]);
    else if (mouthfeel.rich > 45) bodyPools.push(["味道适中，不浓不淡刚刚好","浓淡得宜，恰到好处"]);
    if (mouthfeel.fresh > 70) bodyPools.push(["清爽不腻，吃完没有负担","满口清爽，一点不油腻","清新怡人，适合多吃几口"]);
    else if (mouthfeel.fresh > 50) bodyPools.push(["整体比较清爽","不会让人觉得腻"]);
    if (taste.salty > 0.3 && taste.umami > 0.35) bodyPools.push([t("flavor.tags.saltyUmami")]);
    if (taste.umami > 0.6) bodyPools.push([t("flavor.tags.umami")]);
    if (taste.sweet > 0.25 && taste.sour > 0.15) bodyPools.push([t("flavor.tags.sweetSour")]);
    if (taste.spicy > 0.4) bodyPools.push([t("flavor.tags.spicy")]);
    if (taste.umami > 0.5 && taste.salty < 0.4) bodyPools.push([t("flavor.tags.lightUmami")]);
    if (taste.aroma > 0.5) bodyPools.push([t("flavor.tags.aroma")]);
    if (m.burn_risk > 0.4 && m.burn_risk <= 0.6 && judgeScore >= 70) bodyPools.push([t("flavor.tags.char")]);
    if (mouthfeel.layered > 50) bodyPools.push(["食材的搭配让层次很丰富"]);
  }

  var bodyParts = pickFromPool(bodyPools);
  if (bodyParts.length === 0) {
    bodyParts.push(tPick("flavor.bodyNeutral"));
  }
  var body = bodyParts.slice(0, 3).join("。") + "。";

  // ── Suggestions (15+ conditions) ──
  // ── Suggestions (randomly pick 2-3 from all matched) ──
  var allSuggestions = [];
  if (m.burn_risk > 0.6) allSuggestions.push("糊味比较明显，火候可以稍微小一点");
  else if (m.burn_risk > 0.35) allSuggestions.push("火候稍微有点大，出现了轻微焦味");
  if (taste.salty > 0.8) allSuggestions.push("咸度偏高，下次可以减少盐或生抽的用量");
  else if (taste.salty > 0.6) allSuggestions.push("稍微偏咸，搭配米饭吃刚好");
  if (taste.salty < 0.08 && taste.umami > 0.2) allSuggestions.push("整体偏淡，可以再加一点点盐来提味");
  if (taste.sweet > 0.6) allSuggestions.push("甜度偏高，喜欢甜口的会很爱");
  if (taste.sour < 0.05 && !(taste.sweet > 0.25 && taste.sour > 0.15)) allSuggestions.push("加一点醋可以提升风味层次，试试看？");
  if (taste.spicy < 0.05 && mainIngs.length >= 2) allSuggestions.push("放一两个干辣椒可以瞬间提香，不妨试试");
  if (m.doneness < 0.2) allSuggestions.push("熟度明显不够，还需要再加热一会儿");
  else if (m.doneness < 0.35) allSuggestions.push("食材还可以再加热一会儿，口感会更好");
  else if (m.doneness > 0.9) allSuggestions.push("食材已经全熟偏软，下次可以减少加热时间保持脆嫩");
  if (mouthfeel.layered < 25) allSuggestions.push("食材种类可以再丰富一些，让味道更有层次");
  if (taste.bitter > 0.4) allSuggestions.push("略带苦味，可能是火候略大或某些食材过熟");
  if (m.oil_g > 50) allSuggestions.push("油量偏多，下次可以适当控油让口感更清爽");
  if (m.water_g > 120 && m.oil_g < 10) allSuggestions.push("汤汁较多，可以大火收一下汁让味道更集中");
  if (!m.browning && m.doneness > 0.5) allSuggestions.push("火力可以再大一点，给食材来个漂亮的上色");

  var suggestions = [];
  if (allSuggestions.length > 0) {
    var pickCount = Math.min(allSuggestions.length, 2 + Math.floor(Math.random() * 2)); // 2-3 random
    var shuffled = allSuggestions.slice().sort(function(){return Math.random()-0.5;});
    suggestions = shuffled.slice(0, pickCount);
  }

  var suggestText = suggestions.length > 0
    ? t("flavor.suggestLead") + suggestions.map(function(s){return "• "+s;}).join("\n")
    : tPick("judge.suggestOk");

  // ── Pairings (20+ options, 4 categories) ──
  var mains = ["🍚 白米饭","🍚 蛋炒饭","🍜 清汤面","🥟 水饺","🫓 馒头","🍞 烤面包"];
  var drinks = ["🍵 绿茶","🍵 乌龙茶","🍺 冰啤酒","🍶 温热清酒","🥤 冰柠檬水","🧊 冰镇酸梅汤"];
  var sides = ["🥗 凉拌小菜","🥒 腌萝卜","🥬 清炒时蔬","🥢 皮蛋豆腐","🧄 蒜泥黄瓜","🥜 盐水花生"];
  var others = ["直接拌饭吃超级香","沾馒头绝配","配一碗热汤就是完美一餐"];

  var pairings = [];
  if (taste.salty > 0.3 && taste.umami > 0.35) pairings.push(pickRandom(mains.slice(0, 3)));
  if (taste.spicy > 0.4) pairings.push(pickRandom(drinks.slice(2, 4)));
  if (taste.umami > 0.5 && taste.salty < 0.4) pairings.push(pickRandom(drinks.slice(0, 2)));
  if (mouthfeel.rich > 55) pairings.push(pickRandom(drinks.slice(4, 6)));
  if (mouthfeel.fresh > 50) pairings.push(pickRandom(sides.slice(0, 3)));
  if (m.oil_g > 30 || m.oil_g > 40) pairings.push(pickRandom(sides));
  if (taste.sweet > 0.25 && taste.sour > 0.15) pairings.push(pickRandom(drinks.slice(4, 6)));
  pairings.push(pickRandom(others));
  if (pairings.length < 2) pairings.push(pickRandom(mains));

  // ── Scenes (15+ options, 4 categories) ──
  var occasions = ["日常家常","周末懒人餐","深夜食堂","上班带饭","一个人的小灶","朋友小聚","全家共享"];
  var seasons = ["夏日清爽","冬日暖锅","春日尝鲜","秋日滋补"];
  var styles = ["快手小炒","慢炖好味","家常经典","新手必学","懒人一锅端","下饭神器"];
  var counts2 = ["一人食","二人世界","三人小灶","全家共享"];

  var scenes = [];
  if (m.water_g > 80 || m.water_g > 150) scenes.push(seasons[1]);
  if (mouthfeel.fresh > 50) scenes.push(seasons[0]);
  scenes.push(pickRandom(occasions));
  var cnt = Math.min(mainIngs.length, 3);
  scenes.push(counts2[cnt] || counts2[0]);
  scenes.push(pickRandom(styles));
  if (taste.spicy > 0.4) scenes.push("朋友聚餐");

  // ── Touch ──
  var touches;
  if (judgeScore >= 90) {
    touches = ["确实难得，这道菜做得像样。","为数不多能放心端上桌的成果。"];
  } else if (judgeScore >= 70) {
    touches = ["马马虎虎，比大多数失败品强点。","能吃完，就这样吧。"];
  } else if (judgeScore >= 50) {
    touches = ["说实话这水平还差得远。","各方面都有肉眼可见的问题。","下次做之前先想想火候和调味。"];
  } else if (judgeScore >= 30) {
    touches = ["这顿饭的教训：调味要克制，火候要观察。","翻车了没关系，但要知道翻在哪里。"];
  } else {
    touches = ["这已经不能称为烹饪了，是乱搞。","建议下次从最简单的菜开始学起。"];
  }
  var touch = pickRandom(touches);
  var judge = judgeDish(session);

  return {
    intro: intro, body: body, suggestText: suggestText,
    pairing: pairings.slice(0, 3).join(t("judge.pairingJoin")),
    scene: scenes.slice(0, 3).join(t("judge.sceneJoin")),
    touch: touch,
    score: judgeScore / 20,
    emoji: judgeScore >= 70 ? "🙂" : judgeScore >= 50 ? "😐" : judgeScore >= 30 ? "😟" : "😵",
    judge: judge,
  };
}
