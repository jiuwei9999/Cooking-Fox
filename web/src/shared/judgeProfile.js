import { t, tPick } from "./i18n.js";

export function isValidDish(session) {
  var pot = session.pot || [];
  var ings = session.ingredients || {};
  var timeline = session.timeline || [];
  var metrics = session.metrics || {};

  var MAIN_IDS = ["egg", "tomato", "cucumber", "potato", "carrot", "onion", "pork", "beef", "chicken", "shrimp", "mushroom", "rice", "noodle"];
  var HEAT_METHODS = ["stir_fry", "pan_fry", "boil", "steam", "bake"];
  var hasMain = false;
  var hasHeat = false;
  var totalG = 0;
  var onlySeasonings = true;

  for (var i = 0; i < pot.length; i++) {
    var p = pot[i];
    var amt = p.amount_g || 0;
    totalG += amt;
    if (amt < 0.5) continue;
    if (MAIN_IDS.indexOf(p.ingredient_id) >= 0) { hasMain = true; onlySeasonings = false; }
  }

  for (var i = 0; i < timeline.length; i++) {
    var a = timeline[i].action;
    if (a && a.type === "heat" && HEAT_METHODS.indexOf(a.heat_method) >= 0) { hasHeat = true; break; }
  }

  // Check for butter-only
  var butterOnly = pot.length === 1 && pot[0].ingredient_id === "butter" && (pot[0].amount_g || 0) > 0;
  if (butterOnly) return { valid: false, category: "not_a_dish", reason: t("judge.invalid.butterOnly") };

  // No main ingredient
  if (!hasMain && totalG > 0) {
    if (totalG < 5) return { valid: false, category: "too_little", reason: t("judge.invalid.tooLittle") };
    // Check if it's just salt
    var saltOnly = pot.length === 1 && pot[0].ingredient_id === "salt";
    if (saltOnly) return { valid: false, category: "not_a_dish", reason: t("judge.invalid.saltOnly") };
    // Check if it's just seasonings
    var onlySpices = true;
    var hasSomeLiquid = false;
    for (var i = 0; i < pot.length; i++) {
      var id2 = pot[i].ingredient_id;
      if (id2 === "oil" || id2 === "water" || id2 === "soy_sauce" || id2 === "dark_soy_sauce" || id2 === "vinegar" || id2 === "sesame_oil") hasSomeLiquid = true;
    }
    if (hasSomeLiquid) return { valid: false, category: "sauce_only", reason: t("judge.invalid.sauceOnly") };
    return { valid: false, category: "not_a_dish", reason: t("judge.invalid.notADish") };
  }

  // No heat
  if (!hasHeat && hasMain) {
    return { valid: false, category: "not_cooked", reason: t("judge.invalid.notCooked") };
  }

  // Nothing at all
  if (totalG < 1) {
    return { valid: false, category: "empty", reason: t("judge.invalid.empty") };
  }

  return { valid: true, category: "valid", reason: "" };
}

export function judgeDish(session) {
  // ── Validity check first ──
  var validity = isValidDish(session);
  if (!validity.valid) {
    return {
      valid: false,
      category: validity.category,
      reason: validity.reason,
      total: 0,
      dimensions: [],
      analysis: validity.reason,
      suggestions: [],
      playerComment: validity.category === "not_cooked" ? t("judge.invalidComment.notCooked") :
                     validity.category === "sauce_only" ? t("judge.invalidComment.sauceOnly") :
                     validity.category === "not_a_dish" ? t("judge.invalidComment.notADish") :
                     validity.category === "too_little" ? t("judge.invalidComment.tooLittle") :
                     t("judge.invalidComment.empty"),
    };
  }

  var m = session.metrics || {};
  var taste = m.taste || {};
  var pot = session.pot || [];
  var ings = session.ingredients || {};
  var timeline = session.timeline || [];

  var totalG = m.total_weight_g || 0;
  if (totalG === 0) for (var i = 0; i < pot.length; i++) totalG += (pot[i].amount_g || 0);
  if (totalG < 1) totalG = 1;

  // Count seasoning amounts
  var saltG = 0, soyG = 0, darkSoyG = 0, sugarG = 0, vinegarG = 0, spiceG = 0, oilG = 0;
  for (var i = 0; i < pot.length; i++) {
    var p = pot[i];
    var amt = p.amount_g || 0;
    if (p.ingredient_id === "salt") saltG += amt;
    if (p.ingredient_id === "soy_sauce") soyG += amt;
    if (p.ingredient_id === "dark_soy_sauce") darkSoyG += amt;
    if (p.ingredient_id === "sugar") sugarG += amt;
    if (p.ingredient_id === "vinegar") vinegarG += amt;
    if (p.ingredient_id === "water") continue;
    var ing = ings[p.ingredient_id];
    if (ing && (ing.spice_frac || 0) > 0.03) spiceG += amt;
    if (p.ingredient_id === "oil" || p.ingredient_id === "sesame_oil") oilG += amt;
  }
  var totalSoy = soyG + darkSoyG;
  var estSaltFromSoy = 0;
  if (ings["soy_sauce"]) estSaltFromSoy += soyG * (ings["soy_sauce"].salt_frac || 0.15);
  if (ings["dark_soy_sauce"]) estSaltFromSoy += darkSoyG * (ings["dark_soy_sauce"].salt_frac || 0.14);
  var totalSalt = saltG + estSaltFromSoy + soyG * 0.02 + darkSoyG * 0.02;
  var saltPct = totalSalt / totalG * 100;
  var oilPct = (m.oil_g || oilG) / totalG * 100;

  // Detect dish type
  var mainIngs = [];
  var seasoningIds = ["salt","sugar","pepper","five_spice","soy_sauce","dark_soy_sauce","vinegar","sesame_oil","oyster_sauce","bean_paste","chicken_powder","sesame","starch","cooking_wine","chili_oil","water","oil"];
  for (var i = 0; i < pot.length; i++) {
    if (seasoningIds.indexOf(pot[i].ingredient_id) < 0) mainIngs.push(pot[i].ingredient_id);
  }
  var uniqueMains = [];
  var seen = {};
  for (var i = 0; i < mainIngs.length; i++) { if (!seen[mainIngs[i]]) { seen[mainIngs[i]] = true; uniqueMains.push(mainIngs[i]); } }
  var isSoup = (m.water_g || 0) > totalG * 0.5;
  var isSweet = taste.sweet > 0.3 && taste.salty < 0.15;
  var hasRice = pot.some(function(p){return p.ingredient_id === "rice";});
  var hasMeat = pot.some(function(p){var id = p.ingredient_id; return id === "pork" || id === "beef" || id === "chicken" || id === "shrimp";});
  var hasEgg = pot.some(function(p){return p.ingredient_id === "egg";});
  var hasTomato = pot.some(function(p){return p.ingredient_id === "tomato";});

  // ===== 1. SALT (20pts) =====
  var saltScore;
  var saltNote;
  if (totalG < 10) { saltScore = 10; saltNote = "食材太少，盐度无法准确判断"; }
  else if (saltPct < 0.2) { saltScore = 3; saltNote = "几乎没有咸味，白开水都比这有味道"; }
  else if (saltPct < 0.4) { saltScore = (isSoup ? 12 : 8); saltNote = isSoup ? "汤类偏淡尚可接受" : "偏淡，缺少咸度支撑，味道空虚"; }
  else if (saltPct < 0.7) { saltScore = 16; saltNote = "咸淡凑合，不算出色但能接受"; }
  else if (saltPct < 1.3) { saltScore = 17; saltNote = "咸淡可以，下饭刚好"; }
  else if (saltPct < 1.7) { saltScore = 12; saltNote = "偏咸，吃几口就要喝水"; }
  else if (saltPct < 2.2) { saltScore = 6; saltNote = "盐像一拳直接打在舌头上"; }
  else if (saltPct < 3.5) { saltScore = 2; saltNote = "咸得离谱，这已经不是调味了"; }
  else { saltScore = 0; saltNote = "这不是在放盐，是在报复味蕾"; }
  if (isSweet && saltPct > 0.5) { saltScore -= 5; saltNote += "（甜品放盐严重扣分）"; }
  saltScore = Math.max(0, Math.min(20, saltScore));

  // ===== 2. OIL (15pts) =====
  var oilScore;
  var oilNote;
  if (oilPct < 1) { oilScore = 3; oilNote = "几乎没有油，干得像在嚼纸"; }
  else if (oilPct < 3) { oilScore = 8; oilNote = "油量偏少，炒菜缺油香气出不来"; }
  else if (oilPct < 6) { oilScore = 12; oilNote = "油量凑合，家常勉强"; }
  else if (oilPct < 10) { oilScore = 11; oilNote = "偏油了，筷子夹起来都在滴油"; }
  else if (oilPct < 15) { oilScore = 8; oilNote = "明显偏油，吃几口就腻"; }
  else if (oilPct < 25) { oilScore = 4; oilNote = "油多得像在喝汤，不是炒菜了"; }
  else if (oilPct < 35) { oilScore = 1; oilNote = "极度油腻，肠胃在抗议"; }
  else { oilScore = 0; oilNote = "这不是炒菜，是油泡实验"; }
  if (isSoup && oilPct > 5) { oilScore -= 3; oilNote += "（汤上漂着一层油）"; }
  if (hasMeat && oilPct < 3) { oilScore -= 2; oilNote += "（肉没有油会柴得像鞋底）"; }
  oilScore = Math.max(0, Math.min(15, oilScore));

  // ===== 3. HEAT / FIRE (20pts) =====
  var burn = m.burn_risk || 0;
  var doneness = m.doneness || 0;
  var browning = m.browning || 0;
  var heatScore;
  var heatNote;
  if (burn > 0.7) { heatScore = 2; heatNote = "严重烧糊！火候完全失控"; }
  else if (burn > 0.5) { heatScore = 6; heatNote = "有明显焦糊，火候偏大"; }
  else if (burn > 0.25) { heatScore = 10; heatNote = "局部略焦，火候稍大"; }
  else if (doneness < 0.1) { heatScore = 3; heatNote = "完全没加热，食材是生的"; }
  else if (doneness < 0.25) { heatScore = 8; heatNote = "熟度明显不足，肉类可能有安全风险"; }
  else if (doneness < 0.4) { heatScore = 12; heatNote = "偏生，吃起来嘎嘣脆——但不是好脆"; }
  else if (doneness < 0.55) { heatScore = 15; heatNote = "火候凑合，熟是熟了"; }
  else if (doneness < 0.8) { heatScore = 16; heatNote = "火候可以，至少没糊没生"; }
  else if (doneness < 0.92) { heatScore = 14; heatNote = "熟度偏高，开始老了"; }
  else { heatScore = 10; heatNote = "过熟软烂，失去了食材该有的口感"; }
  if (browning > 0.25 && burn < 0.3) { heatScore += 2; heatNote += "；上色漂亮有焦香"; }
  if (hasMeat && doneness < 0.3) { heatScore -= 4; heatNote += "（肉类未熟存在安全隐患）"; }
  heatScore = Math.max(0, Math.min(20, heatScore));

  // ===== 4. INGREDIENT COMPATIBILITY (15pts) =====
  var compatScore = 7;
  var compatNotes = [];
  // Good pairs
  var knownPairs = [
    [["egg","tomato"], "番茄炒蛋，经典搭配！"], [["beef","onion"], "牛肉配洋葱，互相增香"], 
    [["butter","mushroom"], "黄油蘑菇，香气绝配"], [["pork","garlic"], "蒜蓉猪肉，经典家常"],
    [["chicken","mushroom"], "鸡肉蘑菇，鲜上加鲜"], [["shrimp","scallion"], "葱香虾仁，简单美味"],
    [["egg","rice"], "蛋炒饭，黄金搭档"], [["tomato","egg"], "番茄蛋，永不败的搭配"]
  ];
  for (var i = 0; i < knownPairs.length; i++) {
    var pair = knownPairs[i][0];
    if (pot.some(function(p){return p.ingredient_id===pair[0];}) && pot.some(function(p){return p.ingredient_id===pair[1];})) {
      compatScore += 3;
      compatNotes.push(knownPairs[i][1]);
      break;
    }
  }
  // Strange pairs
  var weirdPairs = [
    [["garlic","sugar"], "蒜+大量糖，甜蒜组合非常奇怪"],
    [["chili","sugar"], "辣椒+大量糖，除非是甜辣流派否则怪异"],
  ];
  for (var i = 0; i < weirdPairs.length; i++) {
    var wp = weirdPairs[i][0];
    if (pot.some(function(p){return p.ingredient_id===wp[0]&&(p.amount_g||0)>10;}) && pot.some(function(p){return p.ingredient_id===wp[1]&&(p.amount_g||0)>20;})) {
      compatScore -= 3;
      compatNotes.push(weirdPairs[i][1]);
    }
  }
  if (uniqueMains.length === 0) { compatScore -= 5; compatNotes.push("没有主食材，全是调料"); }
  else if (uniqueMains.length >= 4) { compatScore += 2; compatNotes.push("食材丰富，层次感好"); }
  else if (uniqueMains.length <= 1 && totalG > 50) { compatScore -= 2; compatNotes.push("食材单一，味道单调"); }
  compatScore = Math.max(0, Math.min(15, compatScore));

  // ===== 5. SEASONING HARMONY (10pts) =====
  var seasonScore = 4;
  var seasonNotes = [];
  var soyPct = totalSoy / totalG * 100;
  if (totalSoy > 0 && soyPct < 6) { seasonScore += 2; seasonNotes.push("酱油用量合适"); }
  else if (totalSoy > 0 && soyPct > 12) { seasonScore -= 3; seasonNotes.push("酱油过量，会发苦发黑"); }
  if (sugarG > 0 && !isSweet && sugarG / totalG * 100 > 3) { seasonScore -= 3; seasonNotes.push("咸菜中糖偏多，口感不协调"); }
  if (vinegarG > 0 && vinegarG / totalG * 100 > 6) { seasonScore -= 3; seasonNotes.push("醋过量，酸味刺鼻"); }
  if (spiceG > 30) { seasonScore += 2; seasonNotes.push("香料丰富，层次分明"); }
  if (taste.umami > 0.3 && taste.salty > 0.15) { seasonScore += 2; seasonNotes.push("咸鲜平衡到位"); }
  if (saltPct > 2.5 && seasonScore > 4) { seasonScore -= 3; seasonNotes.push("过咸掩盖了其他调料的风味"); }
  if (seasonNotes.length === 0) seasonNotes.push("调料使用中规中矩");
  seasonScore = Math.max(0, Math.min(10, seasonScore));

  // ===== 6. TEXTURE & DONENESS (10pts) =====
  var textureScore = 0;
  var txNote = "";
  if (doneness < 0.15) { textureScore = 2; txNote = "生冷僵硬，无法入口"; }
  else if (doneness < 0.3) { textureScore = 4; txNote = "偏生，口感发硬"; }
  else if (doneness < 0.5) { textureScore = 7; txNote = "熟度适中，口感OK"; }
  else if (doneness < 0.75) { textureScore = 9; txNote = "熟度刚好，口感好"; }
  else if (doneness < 0.9) { textureScore = 8; txNote = "偏熟但口感尚可"; }
  else { textureScore = 5; txNote = "过熟软烂，失去嚼劲"; }
  if (burn > 0.3) { textureScore -= 2; txNote += "；有焦糊感"; }
  textureScore = Math.max(0, Math.min(10, textureScore));

  // ===== 7. APPEARANCE (5pts) =====
  var appearScore;
  var appearNote;
  if (burn > 0.6) { appearScore = 1; appearNote = "烧得焦黑，毫无卖相"; }
  else if (burn > 0.35) { appearScore = 2; appearNote = "局部焦黑，卖相受损"; }
  else if (browning > 0.25 && burn < 0.2) { appearScore = 5; appearNote = "颜色金黄漂亮，看着有食欲"; }
  else if (browning > 0.1) { appearScore = 4; appearNote = "轻微上色，卖相尚可"; }
  else if (doneness < 0.1) { appearScore = 2; appearNote = "完全是生食材的状态"; }
  else { appearScore = 3; appearNote = "卖相普通，家常水平"; }
  appearScore = Math.max(0, Math.min(5, appearScore));

  // ===== 8. TEMPERATURE (5pts) =====
  var temp = m.temp_c || 25;
  var tempScore;
  var tempNote;
  if (isSoup && temp > 50) { tempScore = 5; tempNote = "汤品热度刚好，暖心"; }
  else if (isSoup && temp > 30) { tempScore = 4; tempNote = "汤温热，尚可"; }
  else if (isSoup) { tempScore = 2; tempNote = "汤已经凉了"; }
  else if (temp > 65) { tempScore = 5; tempNote = "热腾腾的，刚好上桌"; }
  else if (temp > 45) { tempScore = 4; tempNote = "温热，吃的时候刚好"; }
  else if (temp > 30) { tempScore = 3; tempNote = "温吞，不够热"; }
  else { tempScore = 2; tempNote = "已经凉了，失去锅气"; }
  tempScore = Math.max(0, Math.min(5, tempScore));

  // ===== TOTAL =====
  var dimensions = [
    { name: t("judge.salt"), score: saltScore, max: 20, note: saltNote },
    { name: t("judge.oil"), score: oilScore, max: 15, note: oilNote },
    { name: t("judge.heat"), score: heatScore, max: 20, note: heatNote },
    { name: t("judge.compat"), score: compatScore, max: 15, note: compatNotes.join("; ") },
    { name: t("judge.season"), score: seasonScore, max: 10, note: seasonNotes.join("; ") },
    { name: t("judge.texture"), score: textureScore, max: 10, note: txNote },
    { name: t("judge.appear"), score: appearScore, max: 5, note: appearNote },
    { name: t("judge.temp"), score: tempScore, max: 5, note: tempNote },
  ];
  var total = 0;
  for (var i = 0; i < dimensions.length; i++) total += dimensions[i].score;

  // Player comment
  var playerComment;
  if (total >= 90) playerComment = t("judge.player.g90");
  else if (total >= 80) playerComment = t("judge.player.g80");
  else if (total >= 70) playerComment = t("judge.player.g70");
  else if (total >= 60) playerComment = t("judge.player.g60");
  else if (total >= 50) playerComment = t("judge.player.g50");
  else if (total >= 40) playerComment = t("judge.player.g40");
  else if (total >= 30) playerComment = t("judge.player.g30");
  else playerComment = t("judge.player.g0");

  // Analysis
  var best = dimensions.reduce(function(a,b){return a.score/a.max > b.score/b.max ? a : b;});
  var worst = dimensions.reduce(function(a,b){return a.score/a.max < b.score/b.max ? a : b;});
  var analysis = worst.score / worst.max < 0.4
    ? t("judge.analysisWorst", { dim: worst.name, note: worst.note })
    : t("judge.analysisMid", { dim: worst.name, note: worst.note });

  // Suggestions
  var suggestions = [];
  for (var i = 0; i < dimensions.length; i++) {
    var d = dimensions[i];
    if (d.score < d.max * 0.45) suggestions.push(d.name + "(" + d.score + "/" + d.max + "): " + d.note);
  }

  return {
    total: total,
    dimensions: dimensions,
    analysis: analysis,
    suggestions: suggestions.length > 0 ? suggestions : tPick("judge.suggestionsOk"),
    playerComment: playerComment,
  };
}

export function generateRadarData(session) {
  var judge = judgeDish(session);
  var m = session.metrics || {};
  var taste = m.taste || {};
  var pot = session.pot || [];
  var totalG = m.total_weight_g || 0;
  if (totalG === 0) for (var i = 0; i < pot.length; i++) totalG += (pot[i].amount_g || 0);
  if (totalG < 1) totalG = 1;
  var water = m.water_g || 0;
  var oil = m.oil_g || 0;
  var doneness = m.doneness || 0;
  var burn = m.burn_risk || 0;
  var browning = m.browning || 0;

  // Count salt for salty mapping
  var saltG = 0;
  for (var i = 0; i < pot.length; i++) {
    var p = pot[i];
    if (p.ingredient_id === "salt") saltG += (p.amount_g || 0);
    if (p.ingredient_id === "soy_sauce") saltG += (p.amount_g || 0) * 0.15;
    if (p.ingredient_id === "dark_soy_sauce") saltG += (p.amount_g || 0) * 0.14;
  }
  var saltPct = saltG / totalG * 100;

  return [
    { key: "salty", label: t("judge.radar.salty"), value: Math.round(Math.min(100, saltPct * 40)) },
    { key: "sweet", label: t("judge.radar.sweet"), value: Math.round((taste.sweet || 0) * 100) },
    { key: "oily", label: t("judge.radar.oily"), value: Math.round(Math.min(100, oil / totalG * 200)) },
    { key: "heat", label: t("judge.radar.heat"), value: Math.round(Math.max(5, doneness * 100 - burn * 100 + (burn < 0.2 && browning > 0.15 ? 15 : 0))) },
    { key: "umami", label: t("judge.radar.umami"), value: Math.round((taste.umami || 0) * 100) },
    { key: "crisp", label: t("judge.radar.crisp"), value: Math.round(Math.min(100, browning * 100 + (1 - water / totalG) * 30)) },
    { key: "moist", label: t("judge.radar.moist"), value: Math.round(Math.min(100, water / totalG * 200)) },
    { key: "harmony", label: t("judge.radar.harmony"), value: Math.round(Math.max(5, judge.total / 100 * 100)) },
  ];
}
