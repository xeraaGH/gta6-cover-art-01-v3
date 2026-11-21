// Vice Cover Studio v3 — the editor. Wires the page: pick a layout and a size,
// give every panel a DIFFERENT photo, grade each panel, write the caption,
// stick stickers on, and export the cover as a PNG. A `?shot=` query sets up
// a fixed scene for a screenshot instead (./shots.js).
import { PHOTOS, LAYOUTS, SIZES, GRADES, STICKERS, defaultPanels, layoutRects, drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const hintEl = document.getElementById('panel-hint');

/** The editor state: everything drawCover needs, plus the selected panel. */
const state = {
  layout: 'quad',
  size: SIZES[2],
  nightShift: true,
  title: 'MIDNIGHT VICE',
  subtitle: 'after dark in vice city',
  panels: defaultPanels('quad'),
  stickers: [
    { kind: 'palm', x: 0.1, y: 0.12, s: 0.09, rot: -0.12 },
    { kind: 'sun', x: 0.89, y: 0.1, s: 0.07, rot: 0.2 },
    { kind: 'seal', x: 0.9, y: 0.86, s: 0.08, rot: 0.15 },
  ],
  selected: 0,
};

/** Loaded photos by key: the library plus anything the user uploads. */
const images = {};
/** Uploaded photos, in the order they arrived, for the library strip. */
const uploads = [];
let uploadCount = 0;
/** How far the library order has been rotated by "Fill distinct". */
let fillRotation = 0;

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('16px Anton'),
      document.fonts.load('16px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // The canvas falls back to sans-serif; the cover still draws.
  }
}

async function loadLibrary() {
  for (const photo of PHOTOS) {
    images[photo.key] = await loadImage(photo.src);
  }
}

function redraw() {
  drawCover(canvas, state, images);
  markLibrary();
  hintEl.textContent = `Panel ${state.selected + 1} selected (${state.panels[state.selected].photoKey}, ${state.panels[state.selected].grade}). Drag the cover to pan its photo, scroll to zoom it.`;
}

/** Marks the library thumbnails that are in use on the cover. */
function markLibrary() {
  const used = new Set(state.panels.map((p) => p.photoKey));
  document.querySelectorAll('#library figure').forEach((fig) => {
    fig.classList.toggle('in-use', used.has(fig.dataset.key));
  });
}

/** Builds one row of toggle buttons from a list of {key, name|label}. */
function buildButtons(containerId, items, current, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.name ?? item.label;
    b.dataset.key = item.key;
    if (item.key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      onPick(item.key);
    });
    box.appendChild(b);
  }
}

function buildControls() {
  buildButtons('layouts', Object.entries(LAYOUTS).map(([key, v]) => ({ key, name: v.name })), state.layout, (key) => {
    state.layout = key;
    state.panels = defaultPanels(key);
    state.selected = 0;
    redraw();
  });
  buildButtons('sizes', SIZES, state.size.key, (key) => {
    state.size = SIZES.find((s) => s.key === key);
    redraw();
  });
  buildButtons('grades', GRADES, state.panels[state.selected].grade, (key) => {
    state.panels[state.selected].grade = key;
    redraw();
  });
  const stickerBox = document.getElementById('stickers');
  stickerBox.innerHTML = '';
  for (const st of STICKERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = st.name;
    b.addEventListener('click', () => {
      state.stickers.push({ kind: st.kind, x: 0.5, y: 0.5, s: 0.08, rot: (Math.random() - 0.5) * 0.4 });
      redraw();
    });
    stickerBox.appendChild(b);
  }
  buildLibrary();
}

function buildLibrary() {
  const box = document.getElementById('library');
  box.innerHTML = '';
  const entries = [
    ...PHOTOS.map((p) => ({ key: p.key, src: p.src, label: p.label })),
    ...uploads.map((u) => ({ key: u.key, src: u.url, label: u.label })),
  ];
  for (const entry of entries) {
    const fig = document.createElement('figure');
    fig.dataset.key = entry.key;
    const img = document.createElement('img');
    img.src = entry.src;
    img.alt = entry.label;
    const cap = document.createElement('figcaption');
    cap.textContent = entry.label;
    fig.append(img, cap);
    fig.addEventListener('click', () => {
      assignPhoto(state.selected, entry.key);
      redraw();
    });
    box.appendChild(fig);
  }
  markLibrary();
}

/**
 * Gives a panel a photo. When the photo is already on another panel the two
 * swap, so a photo is never used twice in one cover.
 */
function assignPhoto(panelIndex, photoKey) {
  const other = state.panels.findIndex((p, i) => i !== panelIndex && p.photoKey === photoKey);
  if (other !== -1) state.panels[other].photoKey = state.panels[panelIndex].photoKey;
  state.panels[panelIndex].photoKey = photoKey;
  state.panels[panelIndex].zoom = 1;
  state.panels[panelIndex].ox = 0;
  state.panels[panelIndex].oy = 0;
}

/** Fills every panel with a different photo, rotating the library order. */
function fillDistinct() {
  const keys = PHOTOS.map((p) => p.key);
  fillRotation = (fillRotation + 1) % keys.length;
  const rotated = [...keys.slice(fillRotation), ...keys.slice(0, fillRotation)];
  state.panels.forEach((panel, i) => {
    panel.photoKey = rotated[i % rotated.length];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
  });
  redraw();
}

/** Shuffles the library and deals a different photo to every panel. */
function shufflePhotos() {
  const keys = [...PHOTOS.map((p) => p.key)];
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  state.panels.forEach((panel, i) => {
    panel.photoKey = keys[i % keys.length];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
  });
  redraw();
}

/** Canvas coordinates (in cover pixels) for a pointer event. */
function eventPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

/** The panel index under a cover point, or -1. */
function panelAt(x, y) {
  const rects = layoutRects(state.layout, canvas.width, canvas.height, Math.max(6, Math.round(canvas.width * 0.008)));
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/** The sticker index under a cover point, or -1 (topmost first). */
function stickerAt(x, y) {
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const st = state.stickers[i];
    const dx = x - st.x * canvas.width;
    const dy = y - st.y * canvas.height;
    if (Math.hypot(dx, dy) < st.s * canvas.width * 0.62) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const p = eventPoint(e);
  const si = stickerAt(p.x, p.y);
  if (si !== -1) {
    drag = { kind: 'sticker', index: si, moved: false };
  } else {
    const pi = panelAt(p.x, p.y);
    if (pi !== -1) {
      state.selected = pi;
      buildButtons('grades', GRADES, state.panels[pi].grade, (key) => {
        state.panels[pi].grade = key;
        redraw();
      });
      drag = { kind: 'panel', index: pi, x: p.x, y: p.y, moved: false };
      redraw();
    }
  }
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = eventPoint(e);
  if (drag.kind === 'sticker') {
    const st = state.stickers[drag.index];
    st.x = Math.min(1, Math.max(0, p.x / canvas.width));
    st.y = Math.min(1, Math.max(0, p.y / canvas.height));
    drag.moved = true;
    redraw();
  } else {
    const panel = state.panels[drag.index];
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    panel.ox = Math.min(0.5, Math.max(-0.5, panel.ox + dx / canvas.width));
    panel.oy = Math.min(0.5, Math.max(-0.5, panel.oy + dy / canvas.height));
    drag.x = p.x;
    drag.y = p.y;
    redraw();
  }
});

canvas.addEventListener('pointerup', () => {
  drag = null;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  redraw();
}, { passive: false });

canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  for (const file of e.dataTransfer.files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const key = `upload-${++uploadCount}`;
    images[key] = await loadImage(url);
    uploads.push({ key, url, label: file.name.replace(/\.[^.]+$/, '').slice(0, 10) || 'Upload' });
    assignPhoto(state.selected, key);
    buildLibrary();
    redraw();
  }
});

document.getElementById('upload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const url = URL.createObjectURL(file);
    const key = `upload-${++uploadCount}`;
    images[key] = await loadImage(url);
    uploads.push({ key, url, label: file.name.replace(/\.[^.]+$/, '').slice(0, 10) || 'Upload' });
    assignPhoto(state.selected, key);
  }
  buildLibrary();
  redraw();
});

document.getElementById('fill-distinct').addEventListener('click', fillDistinct);
document.getElementById('shuffle').addEventListener('click', shufflePhotos);
document.getElementById('clear-stickers').addEventListener('click', () => {
  state.stickers = [];
  redraw();
});
document.getElementById('night').addEventListener('change', (e) => {
  state.nightShift = e.target.checked;
  redraw();
});
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});

/** Renders the cover at the export size and downloads it as a PNG. */
function exportCover() {
  const off = document.createElement('canvas');
  drawCover(off, state, images);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.size.w}x${state.size.h}.png`;
    a.click();
    statusEl.textContent = `Saved vice-cover-${state.size.w}x${state.size.h}.png`;
  }, 'image/png');
}
document.getElementById('export').addEventListener('click', exportCover);

/** Renders the current cover and returns it as a PNG data URL (for screenshots). */
window.__exportCover = () => new Promise((resolve) => {
  const off = document.createElement('canvas');
  drawCover(off, state, images);
  off.toBlob((blob) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  }, 'image/png');
});

/** The editor API the screenshot scenes drive. */
const editor = {
  state,
  images,
  setLayout(key) {
    state.layout = key;
    state.panels = defaultPanels(key);
    state.selected = 0;
  },
  setSize(key) {
    state.size = SIZES.find((s) => s.key === key) ?? state.size;
  },
  setTitle(text) { state.title = text; },
  setSubtitle(text) { state.subtitle = text; },
  setNight(on) {
    state.nightShift = on;
    document.getElementById('night').checked = on;
  },
  setGradeAll(grade) {
    state.panels.forEach((p) => { p.grade = grade; });
  },
  addSticker(kind, x, y, s = 0.08, rot = 0) {
    state.stickers.push({ kind, x, y, s, rot });
  },
  clearStickers() { state.stickers = []; },
  redraw,
};

buildControls();
await loadFonts();
await loadLibrary();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  await runShot(shot, params, editor);
} else {
  redraw();
}
