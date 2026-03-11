export function round1(x) {
  return Math.round(Number(x || 0) * 10) / 10;
}

export function pct(x) {
  const v = Math.max(0, Math.min(1, Number(x || 0)));
  return `${Math.round(v * 100)}%`;
}

export function fmtAction(a) {
  if (!a || !a.type) return "未知操作";
  switch (a.type) {
    case "add":
      return `加入 ${a.ingredient_id || "?"} ${round1(a.amount_g || 0)}g`;
    case "cut":
      return `切配 ${a.cut_style || ""} (${round1(a.particle_mm || 0)}mm)`;
    case "mix":
      return `搅拌 强度${round1(a.mix_intensity || 0)} 时长${round1(a.duration_s || 0)}s`;
    case "heat":
      return `加热 ${a.heat_method || ""} ${round1(a.target_temp_c || 0)}°C ${round1(a.duration_s || 0)}s`;
    case "rest":
      return `静置 ${round1(a.duration_s || 0)}s`;
    case "taste":
      return "尝味";
    case "serve":
      return "出锅";
    default:
      return a.type;
  }
}

