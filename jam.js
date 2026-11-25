// Jam sandbox: improvise over the band. Shows which notes are safe over the
// current chord (and previews the next change), plus a suggestion per chorus.

const Jam = (() => {
  const ZONES = {
    all: { name: 'Whole neck', ranges: null },
    low: { name: 'Low (frets 0–5)', ranges: [[0, 5]] },
    mid: { name: 'Middle (frets 4–9)', ranges: [[4, 9]] },
    upper: { name: 'Upper (frets 7–12)', ranges: [[7, 12]] },
    high: { name: 'High (frets 10–15)', ranges: [[10, 15]] },
  };

  const SCALE_NOTES = {
    minor: 'The minor pentatonic is the classic blues choice. It works over every chord in the progression.',
    blues: 'The blues scale is the minor pentatonic plus the blue note (purple). Use the blue note as a passing note and don’t rest on it.',
    major: 'The major pentatonic sounds sweeter and brighter. It suits the home chord best, so listen for notes that fight the chord when it changes.',
    follow: 'Each chord gets its own pentatonic built on its root (major over dominant chords, minor over minor ones), so the safe notes move when the chord does. The orange root always works.',
  };

  const el = {
    scale: $('#jam-scale'),
    zone: $('#jam-zone'),
    setup: $('#jam-setup'),
    chord: $('#jam-chord'),
    numeral: $('#jam-numeral'),
    next: $('#jam-next'),
    pos: $('#jam-pos'),
    prompt: $('#jam-prompt'),
    legend: $('#jam-legend'),
    targets: $('#jam-targets'),
    scaleNote: $('#jam-scale-note'),
  };

  for (const [id, s] of Object.entries(SCALES)) el.scale.append(new Option(s.name, id));
  for (const [id, z] of Object.entries(ZONES)) el.zone.append(new Option(z.name, id));

  const neck = createFretboard($('#jam-neck'), (midi) => engine.pluck(midi));
  let lastTick = null; // newest tick while playing, else null
  let neckKey = '';

  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text; // avoid re-announcing unchanged text
  };

  // The next bar whose chord differs from the current one, and how many beats away it is.
  function nextChange(key, bar, beat) {
    const cur = chordAt(key, bar, state.progression);
    for (let n = 1; n <= 12; n++) {
      const c = chordAt(key, (bar + n) % 12, state.progression);
      if (c.name !== cur.name) return { chord: c, beats: n * 4 - beat };
    }
    return null;
  }

  function renderLegend() {
    const items = [
      ['var(--accent)', 'Chord root: the best note to land on'],
      ['var(--chord)', 'Other chord tone: a strong target'],
      ['#8fa0bd', 'Safe note: fits, but passes through'],
    ];
    if (state.scale === 'blues') items.push(['var(--blue)', 'Blue note: passing only']);
    el.legend.replaceChildren(
      ...items.map(([color, label]) => {
        const li = document.createElement('li');
        li.style.setProperty('--c', color);
        li.textContent = label;
        return li;
      })
    );
    const ring = document.createElement('li');
    ring.className = 'ring';
    ring.textContent = 'Dashed ring: root of the next chord, coming up';
    el.legend.append(ring);
  }

  function update() {
    const key = KEYS[state.key];
    const bar = lastTick ? lastTick.bar : 0;
    const beat = lastTick ? lastTick.beat : 0;
    const chord = chordAt(key, bar, state.progression);
    const next = nextChange(key, bar, beat);

    setText(el.chord, chord.name);
    setText(el.numeral, chord.numeral);
    if (next) {
      const when = next.beats <= 8 ? `${next.beats} beat${next.beats === 1 ? '' : 's'}` : `${Math.ceil(next.beats / 4)} bars`;
      setText(el.next, `Next: ${next.chord.name} in ${when}`);
    } else {
      setText(el.next, 'The chord stays the same');
    }
    setText(el.pos, lastTick ? `Bar ${bar + 1} of 12 · Chorus ${lastTick.chorus + 1}` : 'Stopped');
    setText(
      el.prompt,
      lastTick
        ? `Chorus ${lastTick.chorus + 1}: ${JAM_PROMPTS[lastTick.chorus % JAM_PROMPTS.length]}`
        : 'Press Play. Each chorus brings a new suggestion to try.'
    );
    setText(
      el.setup,
      `${state.key} · ${state.bpm} BPM · ${PROGRESSIONS[state.progression].name} · ${state.feel === 'shuffle' ? 'shuffle' : 'straight'}`
    );

    const pcs = scalePcs(state.scale, key, chord);
    const byInterval = (a, b) => ((a - chord.pc + 12) % 12) - ((b - chord.pc + 12) % 12);
    const names = (list) => list.sort(byInterval).map((pc) => NOTE_NAMES[pc]).join(', ') || 'none';
    setText(
      el.targets,
      `Land on: ${names(pcs.filter((pc) => chord.tones.includes(pc)))}. Also safe: ${names(pcs.filter((pc) => !chord.tones.includes(pc)))}.`
    );

    // Redraw the fretboard only when something it shows has changed.
    const nextRootPc = next && next.beats <= 4 ? next.chord.pc : null;
    const k = [state.key, state.progression, state.scale, state.zone, chord.name, nextRootPc].join('|');
    if (k !== neckKey) {
      neckKey = k;
      neck.render({
        keyPc: key,
        chordPc: chord.pc,
        tones: chord.tones,
        view: 'jam',
        scalePcs: new Set(pcs),
        zone: ZONES[state.zone].ranges,
        blueScale: state.scale === 'blues',
        nextRootPc,
      });
    }
  }

  el.scale.addEventListener('change', () => {
    state.scale = el.scale.value;
    setText(el.scaleNote, SCALE_NOTES[state.scale]);
    renderLegend();
    update();
  });
  el.zone.addEventListener('change', () => {
    state.zone = el.zone.value;
    update();
  });

  el.scale.value = state.scale;
  el.zone.value = state.zone;
  setText(el.scaleNote, SCALE_NOTES[state.scale]);
  renderLegend();
  update();

  return {
    render: update,
    tick(t) {
      lastTick = t;
      update();
    },
  };
})();
