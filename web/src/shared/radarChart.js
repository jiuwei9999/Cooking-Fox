export function drawRadarChart(canvas, taste, options) {
  options = options || {};
  var ctx = canvas.getContext("2d");
  var w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  var cx = w / 2, cy = h / 2, maxR = Math.min(cx, cy) * 0.7;

  // Accept both old format (taste object) and new format (radar data array)
  var axes;
  if (Array.isArray(taste)) {
    axes = taste.map(function(d) {
      return { key: d.key, label: d.label, value: d.value / 100, color: radarColor(d.key) };
    });
  } else {
    axes = [
      { key: "salty", label: "咸", value: taste.salty || 0, color: "#60a5fa" },
      { key: "sweet", label: "甜", value: taste.sweet || 0, color: "#fb923c" },
      { key: "sour", label: "酸", value: taste.sour || 0, color: "#facc15" },
      { key: "spicy", label: "辣", value: taste.spicy || 0, color: "#f87171" },
      { key: "umami", label: "鲜", value: taste.umami || 0, color: "#c084fc" },
      { key: "aroma", label: "香", value: taste.aroma || 0, color: "#fbbf24" },
      { key: "bitter", label: "苦", value: taste.bitter || 0, color: "#94a3b8" },
    ];
  }

  var count = axes.length;
  var angleStep = (Math.PI * 2) / count;

  // Background grid
  var gridLevels = [0.25, 0.5, 0.75, 1.0];
  for (var gi = 0; gi < gridLevels.length; gi++) {
    var level = gridLevels[gi];
    ctx.strokeStyle = "rgba(255,255,255," + (0.06 + level * 0.06) + ")";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (var i2 = 0; i2 < count; i2++) {
      var px2 = cx + Math.cos(i2 * angleStep - Math.PI / 2) * maxR * level;
      var py2 = cy + Math.sin(i2 * angleStep - Math.PI / 2) * maxR * level;
      if (i2 === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Axis lines
  for (var i3 = 0; i3 < count; i3++) {
    var pxa = cx + Math.cos(i3 * angleStep - Math.PI / 2) * maxR;
    var pya = cy + Math.sin(i3 * angleStep - Math.PI / 2) * maxR;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pxa, pya);
    ctx.stroke();
  }

  // Data area
  ctx.beginPath();
  for (var i4 = 0; i4 < count; i4++) {
    var val = Math.max(0, Math.min(1, axes[i4].value));
    var pxd = cx + Math.cos(i4 * angleStep - Math.PI / 2) * maxR * val;
    var pyd = cy + Math.sin(i4 * angleStep - Math.PI / 2) * maxR * val;
    if (i4 === 0) ctx.moveTo(pxd, pyd);
    else ctx.lineTo(pxd, pyd);
  }
  ctx.closePath();

  var fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  fillGrad.addColorStop(0, "rgba(94,234,212,0.25)");
  fillGrad.addColorStop(0.5, "rgba(168,85,247,0.18)");
  fillGrad.addColorStop(1, "rgba(251,113,133,0.08)");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(94,234,212,0.65)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Data points
  for (var i5 = 0; i5 < count; i5++) {
    var val2 = Math.max(0, Math.min(1, axes[i5].value));
    var pxp = cx + Math.cos(i5 * angleStep - Math.PI / 2) * maxR * val2;
    var pyp = cy + Math.sin(i5 * angleStep - Math.PI / 2) * maxR * val2;
    ctx.fillStyle = axes[i5].color;
    ctx.beginPath();
    ctx.arc(pxp, pyp, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels
  var fs = options.fontSize || 12;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (var i6 = 0; i6 < count; i6++) {
    var labelR = maxR * 0.82;
    var plx = cx + Math.cos(i6 * angleStep - Math.PI / 2) * labelR;
    var ply = cy + Math.sin(i6 * angleStep - Math.PI / 2) * labelR;
    var pct = Math.round(Math.max(0, Math.min(1, axes[i6].value)) * 100);
    var text = axes[i6].label + "\n" + pct + "%";
    ctx.fillStyle = axes[i6].color;
    var lines = text.split("\n");
    for (var li = 0; li < lines.length; li++) {
      ctx.font = (li === 0 ? fs : fs - 1) + "px \"Noto Sans SC\", \"PingFang SC\", system-ui, sans-serif";
      ctx.fillText(lines[li], plx, ply + li * (fs + 2));
    }
  }
}

function radarColor(key) {
  switch (key) {
    case "salty": return "#60a5fa";
    case "sweet": return "#fb923c";
    case "oily": return "#facc15";
    case "heat": return "#f87171";
    case "umami": return "#c084fc";
    case "crisp": return "#fbbf24";
    case "moist": return "#4d96ff";
    case "harmony": return "#6bcb77";
    default: return "#aabbcc";
  }
}
