// UI wiring: state, controls, 12-bar grid, current chord panel, fretboard.

const $ = (sel) => document.querySelector(sel);

const state = {
  key: 'E',
  bpm: 90,
  view: 'scale', // 'scale' | 'chord'
  box: 'all', // 'all' | '1'..'5'
  blue: true,
  bar: null, // current bar while playing, else null
};

const engine = new BluesEngine(
  () => ({ keyPc: KEYS[state.key], bpm: state.bpm }),
  (tick) => onTick(tick)
);
const fretboard = createFretboard($('#neck'), (midi) => engine.pluck(midi));

const keyPc = () => KEYS[state.key];
// When stopped, show the I chord so the diagrams are never empty.
const currentChord = () => chordAt(keyPc(), state.bar ?? 0);

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
    const c = chordAt(keyPc(), i);
    el.querySelector('.name').textContent = chordName(c.pc);
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
  const name = chordName(c.pc);
  $('#now-name').textContent = name;
  $('#now-numeral').textContent = c.numeral;
  const roles = ['R', '3', '5', '♭7'];
  $('#now-tones').textContent = 'Notes: ' + chordTones(c.pc).map((pc, i) => `${NOTE_NAMES[pc]} (${roles[i]})`).join('  ');
  $('#now-tip').textContent = TIPS[c.numeral](NOTE_NAMES[c.pc]);
  drawChordDiagram($('#chord-diagram'), SHAPES[name]);
  $('#chord-diagram').setAttribute('aria-label', `${name} chord diagram`);
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
  fretboard.render({
    keyPc: keyPc(),
    chordPc: currentChord().pc,
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
    return;
  }
  markActive(tick.bar, tick.beat);
  if (tick.bar !== lastBar) {
    lastBar = tick.bar;
    state.bar = tick.bar;
    renderNow();
    renderNeck();
  }
}

// ---- Controls -----------------------------------------------------------

for (const k of Object.keys(KEYS)) {
  const o = document.createElement('option');
  o.value = o.textContent = k;
  $('#key').append(o);
}

const playBtn = $('#play');
function setPlaying(on) {
  playBtn.setAttribute('aria-pressed', String(on));
  playBtn.innerHTML = on ? '&#9632; Stop' : '&#9654; Play';
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

playBtn.addEventListener('click', togglePlay);
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

renderAll();
