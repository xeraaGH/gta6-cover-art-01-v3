// Fixed scenes for screenshots. `?shot=cover` shows the cover alone (the editor
// hidden); `?shot=editor` shows the editor with a photo loaded. The query sets
// the layout, size, title, subtitle, grade and night mode, and `stickers` adds
// stickers as kind:x:y triples. window.__shotReady is set once painted.

/**
 * Sets up a screenshot scene. `editor` is the editor API from main.js:
 * setLayout, setSize, setTitle, setSubtitle, setNight, setGradeAll,
 * addSticker, clearStickers, redraw, state.
 */
export async function runShot(shot, query, editor) {
  const layout = query.get('layout') ?? 'quad';
  const size = query.get('size') ?? 'wide';
  const title = query.get('title') ?? 'MIDNIGHT VICE';
  const subtitle = query.get('subtitle') ?? 'after dark in vice city';
  const grade = query.get('grade');
  const night = query.get('night') === '1';

  editor.setLayout(layout);
  editor.setSize(size);
  editor.setTitle(title);
  editor.setSubtitle(subtitle);
  editor.setNight(night);
  if (grade && grade !== 'night') editor.setGradeAll(grade);
  editor.clearStickers();
  const stickers = query.get('stickers');
  if (stickers) {
    for (const part of stickers.split(',')) {
      const [kind, x, y] = part.split(':');
      if (kind) editor.addSticker(kind, Number(x) || 0.5, Number(y) || 0.5);
    }
  }
  // The default scene stickers for a bare cover shot: a palm, a sun and a seal.
  if (!stickers && shot === 'cover') {
    editor.addSticker('palm', 0.1, 0.12, 0.09, -0.12);
    editor.addSticker('sun', 0.89, 0.1, 0.07, 0.2);
    editor.addSticker('seal', 0.9, 0.86, 0.08, 0.15);
  }

  if (shot === 'cover') document.body.classList.add('shot-cover');
  editor.redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
