// SVG fretboard (click a note to hear it) and small chord diagram.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

function createFretboard(svg, onNote) {
  const W = 1000;
  const H = 230;
  const nutX = 64;
  const fw = (W - nutX - 12) / MAX_FRET;
  const top = 28;
  const gap = 34;
  const stringY = (i) => top + i * gap; // i = 0 is the high e string
  const fretX = (f) => nutX + f * fw;
  const noteX = (f) => (f === 0 ? nutX - 26 : nutX + (f - 0.5) * fw);

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();

  // Static board
  svg.append(svgEl('rect', { class: 'board', x: nutX, y: top - 14, width: W - nutX - 12, height: gap * 5 + 28, rx: 4 }));
  for (const f of [3, 5, 7, 9, 15]) {
    svg.append(svgEl('circle', { class: 'inlay', cx: noteX(f), cy: top + gap * 2.5, r: 7 }));
  }
  svg.append(svgEl('circle', { class: 'inlay', cx: noteX(12), cy: top + gap * 1.5, r: 7 }));
  svg.append(svgEl('circle', { class: 'inlay', cx: noteX(12), cy: top + gap * 3.5, r: 7 }));
  for (let f = 0; f <= MAX_FRET; f++) {
    svg.append(svgEl('line', { class: f === 0 ? 'nut' : 'fret', x1: fretX(f), x2: fretX(f), y1: top - 14, y2: top + gap * 5 + 14 }));
  }
  for (let i = 0; i < 6; i++) {
    svg.append(svgEl('line', { class: 'string', x1: nutX, x2: W - 12, y1: stringY(i), y2: stringY(i), 'stroke-width': 1 + i * 0.45 }));
    svg.append(svgEl('text', { class: 'strname', x: 12, y: stringY(i) + 5 }, STRING_NAMES[i]));
  }
  for (const f of [3, 5, 7, 9, 12, 15]) {
    svg.append(svgEl('text', { class: 'fretnum', x: noteX(f), y: H - 6 }, f));
  }

  const dots = svgEl('g');
  svg.append(dots);

  svg.addEventListener('click', (e) => {
    const g = e.target.closest('[data-midi]');
    if (g) onNote(Number(g.dataset.midi));
  });

  function render({ keyPc, chordPc, view, box, blue }) {
    dots.replaceChildren();
    const ranges = boxRanges(keyPc, box);
    const tones = chordTones(chordPc);
    for (let i = 0; i < 6; i++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const midi = OPEN_STRINGS[i] + f;
        const pc = midi % 12;
        const rel = (pc - keyPc + 12) % 12;
        let cls = null;
        if (view === 'scale') {
          const inScale = PENT_MINOR.includes(rel) || (blue && rel === BLUE_NOTE);
          if (!inScale || !inRanges(f, ranges)) continue;
          if (rel === 0) cls = 'root';
          else if (tones.includes(pc)) cls = 'chord';
          else if (rel === BLUE_NOTE) cls = 'blue';
          else cls = 'scale';
        } else {
          if (!tones.includes(pc)) continue;
          cls = pc === chordPc ? 'root' : 'chord';
        }
        const g = svgEl('g', { class: 'dot ' + cls, 'data-midi': midi, tabindex: -1 });
        g.append(svgEl('circle', { cx: noteX(f), cy: stringY(i), r: 13 }));
        g.append(svgEl('text', { x: noteX(f), y: stringY(i) + 4 }, NOTE_NAMES[pc]));
        dots.append(g);
      }
    }
  }

  return { render };
}

function drawChordDiagram(svg, shape) {
  svg.replaceChildren();
  const x0 = 24;
  const sx = 15;
  const y0 = 34;
  const fh = 20;
  const rows = 5;
  const played = shape.frets.filter((f) => f > 0);
  const base = played.length && Math.max(...played) > rows ? Math.min(...played) : 1;
  const sxAt = (i) => x0 + i * sx;

  svg.setAttribute('viewBox', '0 0 120 150');
  if (base > 1) svg.append(svgEl('text', { class: 'cd-base', x: 110, y: y0 + fh / 2 + 4 }, base + 'fr'));
  svg.append(svgEl('line', { class: base === 1 ? 'cd-nut' : 'cd-line', x1: x0, x2: sxAt(5), y1: y0, y2: y0 }));
  for (let r = 1; r <= rows; r++) {
    svg.append(svgEl('line', { class: 'cd-line', x1: x0, x2: sxAt(5), y1: y0 + r * fh, y2: y0 + r * fh }));
  }
  for (let i = 0; i < 6; i++) {
    svg.append(svgEl('line', { class: 'cd-line', x1: sxAt(i), x2: sxAt(i), y1: y0, y2: y0 + rows * fh }));
  }

  const b = shape.barre;
  if (b) {
    const y = y0 + (b.fret - base + 0.5) * fh;
    svg.append(svgEl('rect', { class: 'cd-barre', x: sxAt(b.from) - 6, y: y - 6, width: sxAt(b.to) - sxAt(b.from) + 12, height: 12, rx: 6 }));
  }

  shape.frets.forEach((f, i) => {
    if (f < 0) {
      svg.append(svgEl('text', { class: 'cd-mark', x: sxAt(i), y: y0 - 8 }, '×'));
    } else if (f === 0) {
      svg.append(svgEl('circle', { class: 'cd-open', cx: sxAt(i), cy: y0 - 12, r: 4 }));
    } else if (!(b && f === b.fret && i >= b.from && i <= b.to)) {
      const cy = y0 + (f - base + 0.5) * fh;
      svg.append(svgEl('circle', { class: 'cd-dot', cx: sxAt(i), cy, r: 7 }));
      if (shape.fingers[i]) svg.append(svgEl('text', { class: 'cd-finger', x: sxAt(i), y: cy + 4 }, shape.fingers[i]));
    }
  });
}
