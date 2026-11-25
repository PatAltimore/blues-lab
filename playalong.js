// Play-along: a lick scrolls past as tab; the microphone listens for single
// notes and scores both the note (by name) and the timing.

// Licks as [beat, string, fret relative to the box root, duration in beats].
// Every lick is a multiple of 4 beats long, and neighbouring notes (including
// the wrap from the last note back to the first) never repeat the same note
// name, so a ringing note can't be mistaken for the next one.
const LICKS = [
  {
    id: 'root-walk',
    name: 'Root walk (easiest)',
    length: 8,
    notes: [[0, 6, 0], [1, 6, 3], [2, 5, 0], [3, 5, 2], [4, 5, 0], [5, 6, 3]],
  },
  {
    id: 'climb',
    name: 'Box 1 climb',
    length: 12,
    notes: [[0, 6, 0], [1, 6, 3], [2, 5, 0], [3, 5, 2], [4, 4, 0], [5, 4, 2], [6, 3, 0], [7, 3, 2], [8, 2, 0], [9, 2, 3], [10, 1, 0], [11, 1, 3]],
  },
  {
    id: 'walk-down',
    name: 'Box 1 walk down',
    length: 12,
    notes: [[0, 1, 3], [1, 1, 0], [2, 2, 3], [3, 2, 0], [4, 3, 2], [5, 3, 0], [6, 4, 2], [7, 4, 0], [8, 5, 2], [9, 5, 0], [10, 6, 3], [11, 6, 0]],
  },
  {
    id: 'blue-riff',
    name: 'Blue note riff',
    length: 8,
    notes: [[0, 6, 3], [1, 5, 0], [2, 5, 1], [3, 5, 2], [4, 5, 0], [5, 6, 3], [6, 6, 0, 2]],
  },
];

const PlayAlong = (() => {
  const W = 1000;
  const H = 250;
  const NOW_X = 150; // x of the "play now" line
  const PPB = 110; // pixels per beat
  const TOP = 36;
  const GAP = 34;
  const LATENCY = 0.1; // seconds of microphone + analysis delay
  const MAX_PLAY_HZ = 700;

  const el = {
    toggle: $('#play-toggle'),
    lick: $('#play-lick'),
    key: $('#play-key'),
    bpm: $('#play-bpm'),
    bpmOut: $('#play-bpm-out'),
    canvas: $('#play-canvas'),
    status: $('#play-status'),
    heard: $('#play-heard'),
    streak: $('#play-streak'),
    summary: $('#play-summary'),
    notes: $('#play-notes'),
    error: $('#play-error'),
  };

  for (const l of LICKS) el.lick.append(new Option(l.name, l.id));
  for (const k of Object.keys(KEYS)) el.key.append(new Option(k, k));

  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = W * dpr;
  el.canvas.height = H * dpr;
  const g = el.canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const colors = {
    board: css('--wood') || '#3b2a1e',
    string: '#d6cbbd',
    grid: 'rgba(255,255,255,0.10)',
    bar: 'rgba(255,255,255,0.28)',
    accent: css('--accent') || '#ff9f43',
    good: css('--chord') || '#2fc4b2',
    blue: css('--blue') || '#b57bff',
    scale: '#8fa0bd',
    miss: '#e5484d',
    text: '#14110f',
    label: css('--muted') || '#a99c90',
  };

  let stream = null;
  let source = null;
  let analyser = null;
  let buf = null;
  let running = false;
  let raf = null;
  let timer = null;

  let lick = LICKS[0];
  let targets = [];
  let L = 8;
  let spb = 1;
  let t0 = 0;
  let nextBeat = -4;
  let lastDetect = 0;
  let run = null; // the note currently being held: { pc, first, count, judged, said }
  const judged = new Map(); // "loop:index" -> { res, err }
  const rounds = new Map(); // loop -> { perfect, early, late, miss }
  let session = { perfect: 0, early: 0, late: 0, miss: 0, streak: 0, best: 0 };

  // ---- setup ------------------------------------------------------------

  function buildTargets() {
    const keyPc = KEYS[el.key.value];
    const r = (keyPc - 4 + 12) % 12; // fret of the key's root on the low E string
    lick = LICKS.find((l) => l.id === el.lick.value);
    L = lick.length;
    targets = lick.notes.map(([beat, s, f, dur = 1], i) => {
      const midi = OPEN_STRINGS[s - 1] + r + f;
      const pc = midi % 12;
      return { i, beat, s, fret: f + r, dur, pc, name: NOTE_NAMES[pc], blue: (pc - keyPc + 12) % 12 === BLUE_NOTE };
    });
    el.notes.textContent = 'Notes: ' + targets.map((n) => n.name).join(' – ');
    el.canvas.setAttribute(
      'aria-label',
      'Scrolling tab. Notes to play: ' + targets.map((n) => `${n.name} (string ${n.s}, fret ${n.fret})`).join(', ')
    );
  }

  const perfectWin = () => Math.min(0.15, 0.25 * spb);
  const okWin = () => Math.min(0.35, 0.5 * spb);
  const noteTime = (k, n) => t0 + (n.beat + k * L) * spb;

  function setStatus(text, kind) {
    el.status.textContent = text;
    el.status.dataset.kind = kind;
  }

  // ---- scoring ----------------------------------------------------------

  function record(k, n, res, err) {
    judged.set(k + ':' + n.i, { res, err });
    const r = rounds.get(k) || { perfect: 0, early: 0, late: 0, miss: 0 };
    r[res]++;
    rounds.set(k, r);
    session[res]++;
    session.streak = res === 'miss' ? 0 : session.streak + 1;
    session.best = Math.max(session.best, session.streak);
    el.streak.textContent = session.streak;
    if (r.perfect + r.early + r.late + r.miss === targets.length) {
      const hits = targets.length - r.miss;
      el.summary.textContent =
        `Round ${k + 1}: ${hits} of ${targets.length} notes · ${r.perfect} perfect, ${r.early} early, ${r.late} late, ${r.miss} missed`;
    }
  }

  function judgeRun(r) {
    const onset = r.first - LATENCY;
    const ok = okWin();
    const kMid = Math.max(0, Math.floor((onset - t0) / (L * spb)));
    let best = null;
    let wrongFor = null;
    for (let k = Math.max(0, kMid - 1); k <= kMid + 1; k++) {
      for (const n of targets) {
        if (judged.has(k + ':' + n.i)) continue;
        const err = onset - noteTime(k, n);
        if (Math.abs(err) > ok) continue;
        if (n.pc === r.pc) {
          if (!best || Math.abs(err) < Math.abs(best.err)) best = { k, n, err };
        } else if (!wrongFor) {
          wrongFor = n;
        }
      }
    }
    if (best) {
      r.judged = true;
      const ms = Math.round(best.err * 1000);
      let res = 'perfect';
      if (Math.abs(best.err) > perfectWin()) res = best.err < 0 ? 'early' : 'late';
      record(best.k, best.n, res, best.err);
      if (res === 'perfect') setStatus('Perfect!', 'good');
      else setStatus(`${res === 'early' ? 'Early' : 'Late'} (${ms > 0 ? '+' : ''}${ms} ms)`, 'warn');
    } else if (wrongFor && !r.said) {
      r.said = true;
      setStatus(`Heard ${NOTE_NAMES[r.pc]}. Aim for ${wrongFor.name}`, 'bad');
    }
  }

  function markMisses(now) {
    const kNow = Math.max(0, Math.floor((now - t0) / (L * spb)));
    const late = okWin() + LATENCY + 0.1;
    for (let k = Math.max(0, kNow - 2); k <= kNow; k++) {
      for (const n of targets) {
        if (!judged.has(k + ':' + n.i) && now > noteTime(k, n) + late) {
          record(k, n, 'miss', null);
          setStatus(`Missed ${n.name}`, 'bad');
        }
      }
    }
  }

  // ---- listening --------------------------------------------------------

  function listen(now) {
    analyser.getFloatTimeDomainData(buf);
    const r = detectPitch(buf, engine.ctx.sampleRate, MAX_PLAY_HZ);
    let pc = null;
    if (r) {
      const m = 69 + 12 * Math.log2(r.freq / 440);
      const nearest = Math.round(m);
      if (Math.abs(m - nearest) <= 0.4) pc = ((nearest % 12) + 12) % 12; // ignore notes far out of tune
    }
    if (pc === null) {
      run = null;
      el.heard.textContent = '–';
      return;
    }
    el.heard.textContent = NOTE_NAMES[pc];
    if (run && run.pc === pc) run.count++;
    else run = { pc, first: now, count: 1, judged: false, said: false };
    if (run.count >= 2 && !run.judged) judgeRun(run); // two frames in a row = a real note
  }

  // ---- drawing ----------------------------------------------------------

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function draw(now) {
    const pos = running ? (now - t0) / spb : -1.2; // position in beats
    g.clearRect(0, 0, W, H);
    g.fillStyle = colors.board;
    rr(0, 0, W, H, 10);
    g.fill();

    // beat grid
    const b0 = Math.floor(pos - NOW_X / PPB);
    const b1 = Math.ceil(pos + (W - NOW_X) / PPB);
    for (let b = b0; b <= b1; b++) {
      const x = NOW_X + (b - pos) * PPB;
      g.strokeStyle = ((b % 4) + 4) % 4 === 0 ? colors.bar : colors.grid;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, 12);
      g.lineTo(x, H - 12);
      g.stroke();
    }

    // strings
    g.font = 'bold 14px system-ui, sans-serif';
    g.textAlign = 'center';
    for (let i = 0; i < 6; i++) {
      const y = TOP + i * GAP;
      g.strokeStyle = colors.string;
      g.globalAlpha = 0.6;
      g.lineWidth = 1 + i * 0.35;
      g.beginPath();
      g.moveTo(34, y);
      g.lineTo(W - 10, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = colors.label;
      g.fillText(STRING_NAMES[i], 16, y + 5);
    }

    // notes
    const ok = okWin();
    const kFrom = Math.max(0, Math.floor((pos - NOW_X / PPB - 2) / L));
    const kTo = Math.floor((pos + (W - NOW_X) / PPB) / L);
    for (let k = kFrom; k <= kTo; k++) {
      for (const n of targets) {
        const left = NOW_X + (n.beat + k * L - pos) * PPB;
        const w = Math.max(36, n.dur * PPB - 10);
        if (left > W || left + w < 36) continue;
        const y = TOP + (n.s - 1) * GAP;
        const result = judged.get(k + ':' + n.i);
        let fill = n.blue ? colors.blue : colors.scale;
        if (result) fill = result.res === 'miss' ? colors.miss : result.res === 'perfect' ? colors.good : colors.accent;
        g.globalAlpha = result && result.res === 'miss' ? 0.55 : 1;
        g.fillStyle = fill;
        rr(left, y - 13, w, 26, 8);
        g.fill();
        g.globalAlpha = 1;
        if (running && !result && Math.abs(now - noteTime(k, n)) <= ok) {
          g.strokeStyle = '#fff';
          g.lineWidth = 3;
          g.stroke();
        }
        g.fillStyle = colors.text;
        g.fillText(String(n.fret), left + 18, y + 5);
      }
    }

    // "play now" line
    g.strokeStyle = colors.accent;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(NOW_X, 8);
    g.lineTo(NOW_X, H - 8);
    g.stroke();

    // overlay text
    g.font = 'bold 22px system-ui, sans-serif';
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    if (!running) g.fillText('Press Start, then play each note as it reaches the line', W / 2, H - 14);
    else if (pos < 0) g.fillText('Get ready: ' + (Math.floor(pos) + 5), W / 2, H - 14);
  }

  // ---- loop -------------------------------------------------------------

  function schedClicks() {
    while (t0 + nextBeat * spb < engine.ctx.currentTime + 0.15) {
      engine.click(t0 + nextBeat * spb, ((nextBeat % 4) + 4) % 4 === 0);
      nextBeat++;
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = engine.ctx.currentTime;
    if (now - lastDetect >= 0.05) {
      lastDetect = now;
      listen(now);
    }
    markMisses(now);
    draw(now);
  }

  // (Re)start the lick from the count-in.
  function begin() {
    buildTargets();
    spb = 60 / Number(el.bpm.value);
    t0 = engine.ctx.currentTime + 0.2 + 4 * spb;
    nextBeat = -4;
    judged.clear();
    rounds.clear();
    session = { perfect: 0, early: 0, late: 0, miss: 0, streak: 0, best: 0 };
    run = null;
    lastDetect = 0;
    el.streak.textContent = '0';
    el.summary.textContent = '';
    setStatus('Get ready…', 'info');
    clearInterval(timer);
    timer = setInterval(schedClicks, 25);
    schedClicks();
  }

  async function start() {
    el.error.textContent = '';
    if (window.Tuner && Tuner.isOn()) Tuner.stop(); // only one thing can use the mic
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      el.error.textContent = 'This browser does not allow microphone access here. Try Chrome, Edge or Firefox over https or localhost.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      el.error.textContent =
        err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser’s site settings and try again.'
          : 'Could not open a microphone: ' + err.message;
      return;
    }
    engine.init();
    await engine.ctx.resume();
    source = engine.ctx.createMediaStreamSource(stream);
    analyser = engine.ctx.createAnalyser();
    analyser.fftSize = 4096;
    buf = new Float32Array(analyser.fftSize);
    source.connect(analyser); // not routed to the speakers
    running = true;
    el.toggle.setAttribute('aria-pressed', 'true');
    el.toggle.textContent = 'Stop';
    begin();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    if (source) source.disconnect();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    source = analyser = stream = null;
    const total = session.perfect + session.early + session.late + session.miss;
    if (total > 0) {
      el.summary.textContent =
        `Session: ${total - session.miss} of ${total} notes hit · ${session.perfect} perfect · best streak ${session.best}`;
    }
    el.toggle.setAttribute('aria-pressed', 'false');
    el.toggle.textContent = 'Start play-along';
    el.heard.textContent = '–';
    setStatus('Stopped', 'info');
    draw(0);
  }

  function changed() {
    el.bpmOut.textContent = el.bpm.value + ' BPM';
    if (running) begin();
    else {
      buildTargets();
      draw(0);
    }
  }

  el.toggle.addEventListener('click', () => (running ? stop() : start()));
  el.lick.addEventListener('change', changed);
  el.key.addEventListener('change', changed);
  el.bpm.addEventListener('input', changed);

  buildTargets();
  setStatus('Ready when you are', 'info');
  draw(0);

  // For tests: the timeline and results so far.
  const snapshot = () => ({ running, t0, spb, length: L, targets, session: { ...session }, judged: [...judged.entries()] });
  return { stop, snapshot };
})();
