// UI wiring: state, controls, 12-bar grid, current chord panel, fretboard.

const $ = (sel) => document.querySelector(sel);

const state = {
  key: 'E',
  bpm: 90,
  view: 'scale', // 'scale' | 'chord'
  box: 'all', // 'all' | '1'..'5'
  blue: true,
  progression: 'standard', // key of PROGRESSIONS
  feel: 'shuffle', // key of FEELS
  scale: 'minor', // jam sandbox scale, key of SCALES
  zone: 'all', // jam sandbox neck area
  bar: null, // current bar while playing, else null
};

const engine = new BluesEngine(
  () => ({ keyPc: KEYS[state.key], bpm: state.bpm, prog: state.progression, feel: state.feel }),
  (tick) => onTick(tick)
);
const fretboard = createFretboard($('#neck'), (midi) => engine.pluck(midi));

const keyPc = () => KEYS[state.key];
// When stopped, show the first chord so the diagrams are never empty.
const currentChord = () => chordAt(keyPc(), state.bar ?? 0, state.progression);

// ---- 12-bar grid --------------------------------------------------------

const barEls = [];
for (let i = 0; i < 12; i++) {
  const li = document.createElement('li');
  li.className = 'bar';
  li.innerHTML =
    '<div class="num"><span>Bar ' + (i + 1) + '</span><span class="rn"></span></div>' +
    '<div class="name"></div><div class="beats"><i></i><i></i><i></i><i></i></div>';
  $('#bars').append(li);
  barEls.push(li);
}

function renderBars() {
  barEls.forEach((el, i) => {
    const c = chordAt(keyPc(), i, state.progression);
    el.querySelector('.name').textContent = c.name;
    el.querySelector('.rn').textContent = c.numeral;
  });
}

function markActive(bar, beat) {
  barEls.forEach((el, i) => {
    el.classList.toggle('active', i === bar);
    el.querySelectorAll('.beats i').forEach((b, n) => b.classList.toggle('on', i === bar && n <= beat));
  });
}

// ---- Current chord panel ------------------------------------------------

function renderNow() {
  const c = currentChord();
  $('#now-name').textContent = c.name;
  $('#now-numeral').textContent = c.numeral;
  const roles = ['R', c.quality === 'min' ? '♭3' : '3', '5', '♭7'];
  $('#now-tones').textContent = 'Notes: ' + c.tones.map((pc, i) => `${NOTE_NAMES[pc]} (${roles[i]})`).join('  ');
  $('#now-tip').textContent = TIPS[c.numeral](NOTE_NAMES[c.pc]);
  drawChordDiagram($('#chord-diagram'), chordShape(c.pc, c.quality));
  $('#chord-diagram').setAttribute('aria-label', `${c.name} chord diagram`);
}

// ---- Fretboard ----------------------------------------------------------

const LEGENDS = {
  scale: [
    ['var(--accent)', 'Key root'],
    ['var(--chord)', 'Also in the current chord'],
    ['#8fa0bd', 'Scale note'],
    ['var(--blue)', 'Blue note (passing only)'],
  ],
  chord: [
    ['var(--accent)', 'Chord root'],
    ['var(--chord)', '3rd, 5th, ♭7'],
  ],
};

function renderNeck() {
  const chord = currentChord();
  fretboard.render({
    keyPc: keyPc(),
    chordPc: chord.pc,
    tones: chord.tones,
    view: state.view,
    box: state.box,
    blue: state.blue,
  });
  $('#legend').replaceChildren(
    ...LEGENDS[state.view]
      .filter(([, label]) => state.blue || !label.startsWith('Blue'))
      .map(([color, label]) => {
        const li = document.createElement('li');
        li.style.setProperty('--c', color);
        li.textContent = label;
        return li;
      })
  );
  const scaleOnly = state.view === 'scale';
  $('#box-label').hidden = !scaleOnly;
  $('#blue-label').hidden = !scaleOnly;
}

function renderAll() {
  renderBars();
  renderNow();
  renderNeck();
  if (typeof Jam !== 'undefined') Jam.render();
}

// ---- Playback ticks -----------------------------------------------------

let lastBar = null;
function onTick(tick) {
  if (!tick) {
    state.bar = null;
    lastBar = null;
    markActive(-1, -1);
    renderNow();
    renderNeck();
    if (typeof Jam !== 'undefined') Jam.tick(null);
    return;
  }
  markActive(tick.bar, tick.beat);
  if (tick.bar !== lastBar) {
    lastBar = tick.bar;
    state.bar = tick.bar;
    renderNow();
    renderNeck();
  }
  if (typeof Jam !== 'undefined') Jam.tick(tick);
}

// ---- Controls -----------------------------------------------------------

for (const k of Object.keys(KEYS)) {
  const o = document.createElement('option');
  o.value = o.textContent = k;
  $('#key').append(o);
}
for (const [id, p] of Object.entries(PROGRESSIONS)) $('#progression').append(new Option(p.name, id));

// Both the band card and the jam card have a play button.
function setPlaying(on) {
  document.querySelectorAll('.play-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = on ? '&#9632; Stop' : '&#9654; Play';
  });
}

async function togglePlay() {
  if (engine.playing) {
    engine.stop();
    setPlaying(false);
  } else {
    setPlaying(true);
    try {
      await engine.start();
    } catch (err) {
      console.error(err);
      engine.stop();
      setPlaying(false);
    }
  }
}

document.querySelectorAll('.play-btn').forEach((btn) => btn.addEventListener('click', togglePlay));
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/^(INPUT|SELECT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) {
    e.preventDefault();
    togglePlay();
  }
});

$('#key').addEventListener('change', (e) => {
  state.key = e.target.value;
  renderAll();
});

$('#bpm').addEventListener('input', (e) => {
  state.bpm = Number(e.target.value);
  $('#bpm-out').textContent = state.bpm + ' BPM';
  if (typeof Jam !== 'undefined') Jam.render();
});

$('#progression').addEventListener('change', (e) => {
  state.progression = e.target.value;
  renderAll();
});

$('#feel').addEventListener('change', (e) => {
  state.feel = e.target.value; // takes effect at the next bar
  if (typeof Jam !== 'undefined') Jam.render();
});

document.querySelectorAll('[data-mix]').forEach((cb) => {
  cb.addEventListener('change', () => engine.setMix(cb.dataset.mix, cb.checked));
});

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    renderNeck();
  });
});

$('#box').addEventListener('change', (e) => {
  state.box = e.target.value;
  renderNeck();
});

$('#blue').addEventListener('change', (e) => {
  state.blue = e.target.checked;
  renderNeck();
});

// Used by the course: set the band and fretboard up for a lesson.
function applyPreset(p) {
  // Lessons are written for the standard shuffle 12-bar, so reset those too.
  Object.assign(state, { progression: 'standard', feel: 'shuffle' }, p);
  $('#progression').value = state.progression;
  $('#feel').value = state.feel;
  $('#key').value = state.key;
  $('#bpm').value = state.bpm;
  $('#bpm-out').textContent = state.bpm + ' BPM';
  $('#box').value = state.box;
  $('#blue').checked = state.blue;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  renderAll();
}

renderAll();
