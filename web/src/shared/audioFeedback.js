var audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

export function playCutSound(type) {
  var ctx = getCtx();
  if (!ctx) return;
  var freq, dur, vol;
  switch (type) {
    case "soft": freq = 250; dur = 0.06; vol = 0.15; break;   // tomato, soft veg
    case "crisp": freq = 500; dur = 0.04; vol = 0.12; break;  // onion, carrot
    case "hard": freq = 700; dur = 0.03; vol = 0.10; break;   // tough veg
    case "meat": freq = 180; dur = 0.07; vol = 0.12; break;   // meat
    case "board": freq = 150; dur = 0.05; vol = 0.08; break;  // cutting board hit
    default: freq = 300; dur = 0.05; vol = 0.10;
  }
  try {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
