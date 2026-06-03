const INGREDIENT_DISPLAY_COLORS = {
  // v4
  egg: ["#fff5e0", "#ffe9c0", "#ffd87c"],
  tomato: ["#ef4444", "#dc2626", "#f87171"],
  cucumber: ["#22c55e", "#16a34a", "#4ade80"],
  potato: ["#c4a56e", "#b8954a", "#d4b87e"],
  carrot: ["#f97316", "#ea580c", "#fb923c"],
  onion: ["#d8bfd8", "#c39bd3", "#e6d0e6"],
  pork: ["#f5a0a0", "#e88888", "#fbc0c0"],
  beef: ["#c0392b", "#a93226", "#d46659"],
  chicken: ["#fadbd8", "#f5b7b1", "#fdedec"],
  shrimp: ["#f8a0a0", "#f08080", "#fbc0c0"],
  mushroom: ["#c9a87c", "#b8956a", "#d4b896"],
  rice: ["#fefefe", "#f5f5f5", "#eeeeee"],
  noodle: ["#fde68a", "#fcd34d", "#fef3c7"],
  garlic: ["#fefef5", "#f8f8e8", "#f0f0d8"],
  ginger: ["#e8c46c", "#d4a84a", "#f0d88a"],
  chili: ["#ef4444", "#dc2626", "#f87171"],
  scallion: ["#4ade80", "#22c55e", "#86efac"],
  butter: ["#fef08a", "#fde047", "#fff9c4"],
  soy_sauce: ["#3d2b1f", "#2c1810", "#4e3422"],
  dark_soy_sauce: ["#1a0f0a", "#0d0805", "#2c1810"],
  oil: ["#facc15", "#eab308", "#fde68a"],
  vinegar: ["#d4c8a0", "#c4b890", "#e0d4b0"],
  pepper: ["#6b4e31", "#5a3d22", "#7d5e40"],
  five_spice: ["#8b6914", "#7a5a10", "#9d7a20"],
  tofu: ["#f5f5dc", "#eee8d8", "#faf8f0"],
  cabbage: ["#e8f5e9", "#c8e6c9", "#a5d6a7"],
  bok_choy: ["#86efac", "#4ade80", "#bbf7d0"],
  broccoli: ["#22c55e", "#16a34a", "#4ade80"],
  bell_pepper: ["#ef4444", "#f97316", "#fbbf24"],
  eggplant: ["#6b21a8", "#7c3aed", "#8b5cf6"],
  corn: ["#fbbf24", "#f59e0b", "#fde68a"],
  green_bean: ["#4ade80", "#22c55e", "#86efac"],
  spinach: ["#15803d", "#166534", "#22c55e"],
  celery: ["#bbf7d0", "#86efac", "#4ade80"],
  fish: ["#a8d4f0", "#7ec8e3", "#c4e4f5"],
  lamb: ["#d4a574", "#c4956a", "#e0b88a"],
  duck: ["#c4a882", "#b8956a", "#d4b896"],
  squid: ["#f5d0c5", "#e8b4a8", "#fad4cc"],
  clam: ["#f0e6d2", "#e0d4bc", "#faf0e0"],
  flour: ["#fffbeb", "#fef3c7", "#fde68a"],
};

export function drawDishOnCanvas(canvas, session) {
  const metrics = session.metrics || {};
  const pot = session.pot || [];
  const ingredients = session.ingredients || {};

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.44;

  drawBackground(ctx, w, h);
  drawTableSurface(ctx, w, h, cx, cy, r);
  drawPlate(ctx, cx, cy, r);
  drawFoodBody(ctx, cx, cy, r, pot, ingredients, metrics);
  drawSauce(ctx, cx, cy, r, pot, ingredients, metrics);
  drawBrowningAndBurn(ctx, cx, cy, r, pot, metrics);
  drawGarnish(ctx, cx, cy, r, pot, ingredients, metrics);
  drawSteam(ctx, cx, cy, w, h, metrics);
  drawHighlights(ctx, cx, cy, r, pot);
}

function drawBackground(ctx, w, h) {
  const grad = ctx.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  grad.addColorStop(0, "#1e1b4b");
  grad.addColorStop(0.4, "#131128");
  grad.addColorStop(1, "#0a0a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawTableSurface(ctx, w, h, cx, cy, r) {
  // Tablecloth/wood surface
  const tableGrad = ctx.createLinearGradient(0, cy + r * 1.1, 0, h);
  tableGrad.addColorStop(0, "rgba(30,20,15,0.6)");
  tableGrad.addColorStop(1, "rgba(18,12,8,0.85)");
  ctx.fillStyle = tableGrad;
  ctx.fillRect(0, cy + r * 0.7, w, h - cy - r * 0.7);

  // Subtle wood grain
  ctx.strokeStyle = "rgba(255,255,255,0.015)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    const ly = cy + r * 0.75 + Math.random() * (h - cy - r * 0.75);
    ctx.moveTo(0, ly);
    ctx.quadraticCurveTo(w * 0.5, ly + (Math.random() - 0.5) * 20, w, ly);
    ctx.stroke();
  }
}

function drawPlate(ctx, cx, cy, r) {
  ctx.save();

  // Outer shadow
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = r * 0.3;
  ctx.shadowOffsetX = r * 0.03;
  ctx.shadowOffsetY = r * 0.1;

  // Plate rim shadow
  const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.86, cx, cy, r * 1.06);
  rimGrad.addColorStop(0, "#fafaf7");
  rimGrad.addColorStop(0.4, "#fefefd");
  rimGrad.addColorStop(0.75, "#eae8e3");
  rimGrad.addColorStop(0.92, "#d0cec8");
  rimGrad.addColorStop(1, "#b8b6b0");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // Rim highlight ring
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = r * 0.03;
  ctx.stroke();

  // Inner plate
  const innerGrad = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.18, 0, cx, cy, r * 0.78);
  innerGrad.addColorStop(0, "#fcfcfa");
  innerGrad.addColorStop(1, "#e4e2dc");
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  ctx.restore();
}

function drawFoodBody(ctx, cx, cy, r, pot, ingredients, metrics) {
  const foodR = r * 0.64;
  const doneness = isNaN(metrics.doneness) ? 0 : (metrics.doneness || 0);
  const totalG = pot.reduce((sum, p) => sum + (p.amount_g || 0), 0);

  if (totalG === 0) {
    ctx.fillStyle = "rgba(200,200,200,0.2)";
    ctx.beginPath();
    ctx.arc(cx, cy, foodR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const ingredientColors = [];
  for (const p of pot) {
    const colors = INGREDIENT_DISPLAY_COLORS[p.ingredient_id] || ["#cccccc", "#bbbbbb", "#aaaaaa"];
    const count = Math.max(1, Math.ceil((p.amount_g || 0) / 12));
    for (let i = 0; i < count; i++) ingredientColors.push(colors[i % colors.length]);
  }
  if (ingredientColors.length === 0) return;

  // Base mount shadow
  const shadowGrad = ctx.createRadialGradient(cx, cy + foodR * 0.25, 0, cx, cy + foodR * 0.25, foodR * 0.8);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.2)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, foodR * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // Multi-layer food pile
  const layers = Math.min(6, Math.max(3, Math.ceil(ingredientColors.length / 6)));
  for (let layer = 0; layer < layers; layer++) {
    const layerR = foodR * (1 - layer * 0.1);
    const count = Math.max(3, Math.ceil(ingredientColors.length / layers));
    const angleStep = (Math.PI * 2) / count;
    const offsetAngle = layer * 0.5;

    for (let i = 0; i < count; i++) {
      const angle = offsetAngle + i * angleStep + Math.sin(i * 2.3 + layer) * 0.25;
      const dist = layerR * (0.4 + 0.55 * ((i % 3) / 2 + 0.3));
      const bx = cx + Math.cos(angle) * dist;
      const by = cy - layer * foodR * 0.06 + Math.sin(angle) * dist * 0.3;
      const br = foodR * (0.12 + Math.random() * 0.2);

      const colIdx = (layer * count + i) % ingredientColors.length;
      let color = ingredientColors[colIdx] || "#cccccc";
      var safeR = 180, safeG = 160, safeB = 140;
      if (color && color.length >= 7) {
        safeR = parseInt(color.slice(1,3),16) || 180;
        safeG = parseInt(color.slice(3,5),16) || 160;
        safeB = parseInt(color.slice(5,7),16) || 140;
      }
      var d = isNaN(doneness) ? 0 : Math.min(1, Math.max(0, doneness));
      var f = 1 - d * 0.12, w = d * 0.22;
      var dr = Math.round(Math.max(0,Math.min(255, safeR*f + w*55)));
      var dg = Math.round(Math.max(0,Math.min(255, safeG*f + w*22)));
      var db = Math.round(Math.max(0,Math.min(255, safeB*f - w*10)));
      var donenessColor = "rgb("+dr+","+dg+","+db+")";
      var lr = Math.round(Math.max(0,Math.min(255, safeR*1.15)));
      var lg = Math.round(Math.max(0,Math.min(255, safeG*1.15)));
      var lb = Math.round(Math.max(0,Math.min(255, safeB*1.15)));
      var lightColor = "rgb("+lr+","+lg+","+lb+")";
      var ar = Math.round(Math.max(0,Math.min(255, safeR*0.85)));
      var ag = Math.round(Math.max(0,Math.min(255, safeG*0.85)));
      var ab = Math.round(Math.max(0,Math.min(255, safeB*0.85)));
      var darkColor = "rgb("+ar+","+ag+","+ab+")";

      ctx.save();
      const blobGrad = ctx.createRadialGradient(bx - br * 0.25, by - br * 0.35, 0, bx, by, br);
      blobGrad.addColorStop(0, lightColor);
      blobGrad.addColorStop(0.5, donenessColor);
      blobGrad.addColorStop(1, darkColor);
      ctx.fillStyle = blobGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, br, br * (0.55 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawSauce(ctx, cx, cy, r, pot, ingredients, metrics) {
  const total = pot.reduce((sum, p) => sum + (p.amount_g || 0), 0);
  if (total === 0) return;

  const water = metrics.water_g || 0;
  const oil = metrics.oil_g || 0;
  const liquid = water + oil;
  const sauceAmount = Math.min(1, liquid / Math.max(1, total));

  if (sauceAmount < 0.06) return;

  const foodR = r * 0.64;
  const hasSoy = pot.some((p) => p.ingredient_id === "soy_sauce" || p.ingredient_id === "dark_soy_sauce");
  const hasTomato = pot.some((p) => p.ingredient_id === "tomato");
  const hasChili = pot.some((p) => p.ingredient_id === "chili");

  let sauceColor;
  if (hasSoy) sauceColor = "rgba(55,30,15,";
  else if (hasChili && hasTomato) sauceColor = "rgba(180,55,35,";
  else if (hasTomato) sauceColor = "rgba(195,65,40,";
  else sauceColor = "rgba(210,190,160,";

  const opacity = Math.min(0.5, sauceAmount * 0.65);
  const sauceGrad = ctx.createRadialGradient(cx, cy - foodR * 0.12, 0, cx, cy + foodR * 0.08, foodR * 0.68);
  sauceGrad.addColorStop(0, sauceColor + (opacity * 1.2) + ")");
  sauceGrad.addColorStop(0.7, sauceColor + (opacity * 0.6) + ")");
  sauceGrad.addColorStop(1, sauceColor + "0)");

  ctx.fillStyle = sauceGrad;
  sauceBlob(ctx, cx, cy, foodR * 0.7, 10);
  ctx.fill();

  // Oil shimmer
  if (oil > 3) {
    const oilOp = Math.min(0.22, (oil / Math.max(1, total)) * 0.45);
    for (let i = 0; i < Math.min(10, Math.ceil(oil / 15)); i++) {
      const ox = cx + (Math.random() - 0.5) * foodR * 0.9;
      const oy = cy + (Math.random() - 0.5) * foodR * 0.7;
      ctx.fillStyle = `rgba(255,255,225,${oilOp * (0.5 + Math.random() * 0.5)})`;
      ctx.beginPath();
      ctx.ellipse(ox, oy, foodR * 0.05, foodR * 0.025, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function sauceBlob(ctx, cx, cy, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const variation = 0.65 + Math.random() * 0.7;
    const px = cx + Math.cos(angle) * r * variation;
    const py = cy + Math.sin(angle) * r * variation * 0.65;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBrowningAndBurn(ctx, cx, cy, r, pot, metrics) {
  const browning = metrics.browning || 0;
  const burn = metrics.burn_risk || 0;
  const total = pot.reduce((sum, p) => sum + (p.amount_g || 0), 0);
  if (total === 0) return;

  const foodR = r * 0.64;

  // Golden browning spots
  if (browning > 0.04) {
    const spots = Math.ceil(browning * 24);
    for (let i = 0; i < spots; i++) {
      const sx = cx + (Math.random() - 0.5) * foodR * 1.2;
      const sy = cy + (Math.random() - 0.5) * foodR * 0.85;
      const sr = foodR * (0.025 + browning * 0.1);
      const alpha = Math.min(0.6, browning * 0.8 + Math.random() * 0.2);
      const grad = ctx.createRadialGradient(sx - sr * 0.2, sy - sr * 0.2, 0, sx, sy, sr);
      grad.addColorStop(0, `rgba(180,120,40,${alpha * 0.8})`);
      grad.addColorStop(1, `rgba(100,60,20,${alpha * 0.3})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Dark burn marks
  if (burn > 0.25) {
    const charSpots = Math.ceil(burn * 14);
    for (let i = 0; i < charSpots; i++) {
      const sx = cx + (Math.random() - 0.5) * foodR * 1.0;
      const sy = cy + (Math.random() - 0.5) * foodR * 0.65;
      const sr = foodR * (0.015 + burn * 0.07);
      ctx.fillStyle = `rgba(18,8,3,${Math.min(0.7, burn * 0.95)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGarnish(ctx, cx, cy, r, pot, ingredients, metrics) {
  const total = pot.reduce((sum, p) => sum + (p.amount_g || 0), 0);
  if (total === 0) return;

  const foodR = r * 0.64;
  const hasScallion = pot.some((p) => p.ingredient_id === "scallion");
  const hasChili = pot.some((p) => p.ingredient_id === "chili");
  const hasEgg = pot.some((p) => p.ingredient_id === "egg");

  // Scallion garnish
  if (hasScallion) {
    const count = Math.max(4, Math.min(15, Math.ceil(total / 25)));
    for (let i = 0; i < count; i++) {
      const gx = cx + (Math.random() - 0.5) * foodR * 1.5;
      const gy = cy + (Math.random() - 0.5) * foodR * 0.95;
      const green = 180 + Math.random() * 75;
      ctx.fillStyle = `rgba(${30 + Math.random() * 40},${green},${50 + Math.random() * 60},0.85)`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, foodR * 0.022, foodR * 0.01, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Chili flakes
  if (hasChili) {
    const count = Math.max(3, Math.min(12, Math.ceil(total / 35)));
    for (let i = 0; i < count; i++) {
      const gx = cx + (Math.random() - 0.5) * foodR * 1.4;
      const gy = cy + (Math.random() - 0.5) * foodR * 0.85;
      const red = 210 + Math.random() * 45;
      ctx.fillStyle = `rgba(${red},${35 + Math.random() * 40},${35 + Math.random() * 30},0.9)`;
      ctx.beginPath();
      ctx.arc(gx, gy, foodR * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Egg yellow specks
  if (hasEgg) {
    for (let i = 0; i < 6; i++) {
      const gx = cx + (Math.random() - 0.5) * foodR * 1.25;
      const gy = cy + (Math.random() - 0.5) * foodR * 0.75;
      ctx.fillStyle = `rgba(255,240,200,${0.25 + Math.random() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, foodR * 0.03, foodR * 0.018, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSteam(ctx, cx, cy, w, h, metrics) {
  const temp = metrics.temp_c || 25;
  if (temp < 60) return;
  const intensity = Math.min(1, (temp - 60) / 100);

  for (let i = 0; i < Math.ceil(intensity * 12); i++) {
    const sx = cx + (Math.random() - 0.5) * w * 0.35;
    const sy = cy - w * 0.15 - Math.random() * w * 0.2;
    const sr = 8 + Math.random() * 25;

    ctx.save();
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, `rgba(255,255,255,${intensity * 0.12})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHighlights(ctx, cx, cy, r, pot) {
  const total = pot.reduce((sum, p) => sum + (p.amount_g || 0), 0);
  if (total === 0) return;
  const foodR = r * 0.64;

  // Specular highlight on food mound
  const hlGrad = ctx.createRadialGradient(
    cx - foodR * 0.2, cy - foodR * 0.3, 0,
    cx, cy, foodR * 0.7
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.06)");
  hlGrad.addColorStop(0.4, "rgba(255,255,255,0.02)");
  hlGrad.addColorStop(1, "rgba(0,0,0,0.04)");
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, foodR * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

export { INGREDIENT_DISPLAY_COLORS };
