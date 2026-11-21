// Vice Cover Studio v3 — the cover renderer. Pure canvas 2D, no network.
// Draws a multi-panel poster: a DIFFERENT photo in every panel, a colour grade
// on every panel, a bold outlined stacked title woven across the grid, a script
// subtitle, and draggable stickers. Every layout is its own composition —
// nothing here mirrors official GTA artwork.

/** The five-photo library: the two kit samples plus three image-model photos made for this entry. */
export const PHOTOS = [
  { key: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { key: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
  { key: 'rooftop', src: 'samples/rooftop.jpg', label: 'Rooftop' },
  { key: 'neon', src: 'samples/neon.jpg', label: 'Neon Street' },
  { key: 'beach', src: 'samples/beach.jpg', label: 'Beach Party' },
];

/** The four layouts and how many panels each one holds. */
export const LAYOUTS = {
  poster: { name: 'Poster', panels: 3 },
  grid: { name: 'Grid', panels: 4 },
  hero: { name: 'Hero', panels: 3 },
  quad: { name: 'Quad + Strip', panels: 5 },
};

/** The export sizes: the three common post sizes. */
export const SIZES = [
  { key: 'square', w: 1080, h: 1080, label: '1080 × 1080' },
  { key: 'portrait', w: 1080, h: 1350, label: '1080 × 1350' },
  { key: 'wide', w: 1920, h: 1080, label: '1920 × 1080' },
];

/** The per-panel grades. Every panel always carries one — never an ungraded panel. */
export const GRADES = [
  { key: 'sunset', name: 'Sunset' },
  { key: 'neon', name: 'Neon' },
  { key: 'none', name: 'None' },
];

/** The five stickers, drawn as vector shapes so they stay crisp at any size. */
export const STICKERS = [
  { kind: 'palm', name: 'Palm' },
  { kind: 'sun', name: 'Sun' },
  { kind: 'star', name: 'Star' },
  { kind: 'bolt', name: 'Bolt' },
  { kind: 'seal', name: 'Seal' },
];

/**
 * Which photo each panel starts with, per layout. Every panel gets a DIFFERENT
 * photo — the library order is rotated per layout so no two covers repeat a
 * panel, and a layout never reuses a photo inside one cover.
 */
export const LAYOUT_PHOTOS = {
  poster: ['boulevard', 'rooftop', 'beach'],
  grid: ['neon', 'pier', 'beach', 'rooftop'],
  hero: ['rooftop', 'neon', 'pier'],
  quad: ['boulevard', 'neon', 'rooftop', 'beach', 'pier'],
};

/** A fresh panel: one photo, full-bleed, sunset grade, no pan or zoom. */
export function freshPanel(photoKey) {
  return { photoKey, zoom: 1, ox: 0, oy: 0, grade: 'sunset' };
}

/** The default panels for a layout — distinct photos, sunset grade throughout. */
export function defaultPanels(layout) {
  return LAYOUT_PHOTOS[layout].map((key) => freshPanel(key));
}

/**
 * The panel rectangles for a layout, in fractions of the cover. `gap` is the
 * white gutter between panels, in pixels at the cover's own size.
 */
export function layoutRects(layout, w, h, gap) {
  const g = gap;
  if (layout === 'poster') {
    const cw = (w - 4 * g) / 3;
    return [0, 1, 2].map((i) => ({ x: g + i * (cw + g), y: g, w: cw, h: h - 2 * g }));
  }
  if (layout === 'grid') {
    const cw = (w - 3 * g) / 2;
    const ch = (h - 3 * g) / 2;
    return [
      { x: g, y: g, w: cw, h: ch },
      { x: g + cw + g, y: g, w: cw, h: ch },
      { x: g, y: g + ch + g, w: cw, h: ch },
      { x: g + cw + g, y: g + ch + g, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const bigW = (w - 3 * g) * 0.62;
    const sideW = w - 2 * g - bigW - g;
    const sideH = (h - 3 * g) / 2;
    return [
      { x: g, y: g, w: bigW, h: h - 2 * g },
      { x: g + bigW + g, y: g, w: sideW, h: sideH },
      { x: g + bigW + g, y: g + sideH + g, w: sideW, h: sideH },
    ];
  }
  // quad: a 2x2 grid on top and a wide strip along the bottom.
  const topH = (h - 3 * g) * 0.74;
  const cw = (w - 3 * g) / 2;
  const ch = (topH - g) / 2;
  const stripH = h - 2 * g - topH - g;
  return [
    { x: g, y: g, w: cw, h: ch },
    { x: g + cw + g, y: g, w: cw, h: ch },
    { x: g, y: g + ch + g, w: cw, h: ch },
    { x: g + cw + g, y: g + ch + g, w: cw, h: ch },
    { x: g, y: g + topH + g, w: w - 2 * g, h: stripH },
  ];
}

/** Draws one photo cover-fit into a panel, with the panel's zoom and pan. */
function drawPhoto(ctx, img, rect, panel) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - pw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + panel.oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

/** The colour grade over one panel: warm sunset, cold neon, or a bare vignette. */
function gradePanel(ctx, rect, grade, night) {
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  if (grade === 'sunset') {
    g.addColorStop(0, 'rgba(255, 140, 60, 0.06)');
    g.addColorStop(0.55, 'rgba(255, 90, 60, 0.20)');
    g.addColorStop(1, 'rgba(190, 30, 110, 0.48)');
  } else if (grade === 'neon') {
    g.addColorStop(0, 'rgba(0, 210, 255, 0.12)');
    g.addColorStop(0.55, 'rgba(120, 40, 220, 0.18)');
    g.addColorStop(1, 'rgba(255, 0, 170, 0.38)');
  } else {
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(10, 0, 30, 0.22)');
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (night) {
    ctx.fillStyle = 'rgba(8, 0, 32, 0.20)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const edge = ctx.createLinearGradient(0, rect.y + rect.h * 0.6, 0, rect.y + rect.h);
    edge.addColorStop(0, 'rgba(255, 0, 170, 0)');
    edge.addColorStop(1, 'rgba(255, 0, 170, 0.22)');
    ctx.fillStyle = edge;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** Stacks the title's words into at most three lines that fit `maxWidth`. */
function stackTitle(ctx, words, maxWidth, size) {
  ctx.font = `${size}px Anton, sans-serif`;
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth || line === '') {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** Draws the bold stacked title across the grid, outlined, with a neon offset. */
function drawTitle(ctx, w, h, title, night) {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return;
  const maxWidth = w * 0.92;
  let size = Math.round(w * 0.17);
  let lines = [];
  while (size > 24) {
    lines = stackTitle(ctx, words, maxWidth, size);
    if (lines.length <= 3 && Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxWidth) break;
    size -= 4;
  }
  const lineH = size * 1.04;
  const blockH = lines.length * lineH;
  const cx = w / 2;
  const cy = h * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, -blockH / 2, 0, blockH / 2);
  if (night) {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ff7ad9');
    ctx.shadowColor = 'rgba(255, 0, 170, 0.65)';
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ffe9a8');
    ctx.shadowColor = 'rgba(255, 60, 120, 0.5)';
  }
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.03;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    // Magenta offset copy behind, then the dark outline, then the gradient fill.
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.fillStyle = night ? '#ff2e88' : '#e83e8c';
    ctx.fillText(line, size * 0.035, y + size * 0.035);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineWidth = size * 0.13;
    ctx.strokeStyle = '#160a2e';
    ctx.strokeText(line, 0, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, 0, y);
  });
  ctx.restore();
  return { top: cy - blockH / 2, bottom: cy + blockH / 2, size };
}

/** Draws the script subtitle under the title block. */
function drawSubtitle(ctx, w, h, subtitle, titleBottom) {
  const text = subtitle.trim();
  if (!text) return;
  const size = Math.max(20, Math.round(w * 0.042));
  ctx.save();
  ctx.translate(w / 2, titleBottom + size * 0.9);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.lineWidth = size * 0.14;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a2e';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A five-point star path, centred at (0, 0) with radius r. */
function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draws one sticker at (x, y) in cover pixels, size s, rotated rot radians. */
export function drawSticker(ctx, kind, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.strokeStyle = '#ffffff';
  if (kind === 'palm') {
    ctx.strokeStyle = '#0d3b1e';
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.5);
    ctx.quadraticCurveTo(s * 0.08, 0, 0, -s * 0.35);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.fillStyle = '#0d5c2e';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * (0.15 + i * 0.175);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.35);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.45, -s * 0.35 + Math.sin(a) * s * 0.35, Math.cos(a) * s * 0.55, -s * 0.35 + Math.sin(a) * s * 0.55 + s * 0.18);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.3, -s * 0.35 + Math.sin(a) * s * 0.3, 0, -s * 0.35);
      ctx.fill();
      ctx.stroke();
    }
  } else if (kind === 'sun') {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = s * 0.07;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36);
      ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
      ctx.stroke();
    }
  } else if (kind === 'star') {
    ctx.fillStyle = '#ffd23e';
    starPath(ctx, s * 0.5);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'bolt') {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(s * 0.08, -s * 0.5);
    ctx.lineTo(-s * 0.22, s * 0.08);
    ctx.lineTo(-s * 0.02, s * 0.08);
    ctx.lineTo(-s * 0.08, s * 0.5);
    ctx.lineTo(s * 0.22, -s * 0.08);
    ctx.lineTo(s * 0.02, -s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'seal') {
    ctx.fillStyle = '#ff3b5c';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (Math.PI / 12) * i;
      const r = s * (i % 2 === 0 ? 0.5 : 0.44);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b5c';
    starPath(ctx, s * 0.2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` at `state.size`. `images` maps photo keys
 * to loaded HTMLImageElements. The title is drawn over the panel grid, the
 * stickers on top of everything.
 */
export function drawCover(canvas, state, images) {
  const { w, h } = state.size;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const gap = Math.max(6, Math.round(w * 0.008));
  ctx.fillStyle = '#140a24';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutRects(state.layout, w, h, gap);
  state.panels.forEach((panel, i) => {
    const rect = rects[i];
    if (!rect) return;
    const img = images[panel.photoKey];
    if (img) drawPhoto(ctx, img, rect, panel);
    gradePanel(ctx, rect, panel.grade, state.nightShift);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, gap * 0.45);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  if (state.nightShift) {
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(8, 0, 32, 0)');
    vig.addColorStop(1, 'rgba(8, 0, 32, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
  const titleBox = drawTitle(ctx, w, h, state.title, state.nightShift);
  if (titleBox) drawSubtitle(ctx, w, h, state.subtitle, titleBox.bottom);
  for (const st of state.stickers) {
    drawSticker(ctx, st.kind, st.x * w, st.y * h, st.s * w, st.rot);
  }
}
