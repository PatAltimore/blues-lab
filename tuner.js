// Chromatic-free guitar tuner: listens through the microphone, finds the
// pitch with the McLeod normalised square-difference method and shows how far
// the nearest open string is out of tune. Also plays reference tones.

// Standard tuning, 6th string (low E) first.
const TUNER_STRINGS = OPEN_STRINGS.slice()
  .reverse()
  .map((midi, i) => ({ num: 6 - i, midi, name: NOTE_NAMES[midi % 12], freq: mtof(midi) }));

const IN_TUNE_CENTS = 5;
const MIN_HZ = 70;
const MAX_HZ = 400;
const TUNER_MIN_RMS = 0.002; // quiet enough for a decaying string; the clarity test rejects noise

// Returns { freq, clarity } or null when the signal is too quiet or unclear.
function detectPitch(buf, sampleRate, maxHz = MAX_HZ, minRms = 0.008) {
  const n = buf.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / n) < minRms) return null;

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), n >> 1);
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = minLag - 1; tau <= maxLag + 1; tau++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i < n - tau; i++) {
      acf += buf[i] * buf[i + tau];
      m += buf[i] * buf[i] + buf[i + tau] * buf[i + tau];
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // Local maxima; pick the first one within 90% of the best (avoids octave errors).
  const peaks = [];
  let best = 0;
  for (let t = minLag; t <= maxLag; t++) {
    if (nsdf[t] > 0 && nsdf[t] > nsdf[t - 1] && nsdf[t] >= nsdf[t + 1]) {
      peaks.push(t);
      if (nsdf[t] > best) best = nsdf[t];
    }
  }
  if (best < 0.8) return null;
  const t = peaks.find((p) => nsdf[p] >= 0.9 * best);

  const a = nsdf[t - 1];
  const b = nsdf[t];
  const c = nsdf[t + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return { freq: sampleRate / (t + shift), clarity: b };
}

function nearestString(freq) {
  let best = null;
  for (const s of TUNER_STRINGS) {
    const cents = 1200 * Math.log2(freq / s.freq);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { string: s, cents };
  }
  return best;
}

(function initTuner() {
  const el = {
    toggle: $('#tuner-toggle'),
    note: $('#tuner-note'),
    freq: $('#tuner-freq'),
    needle: $('#tuner-needle'),
    status: $('#tuner-status'),
    error: $('#tuner-error'),
    strings: $('#tuner-strings'),
  };

  const stringBtns = TUNER_STRINGS.map((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'string-btn';
    btn.innerHTML = '<strong></strong><span></span>';
    btn.querySelector('strong').textContent = s.name;
    btn.querySelector('span').textContent = `String ${s.num} · ${s.freq.toFixed(1)} Hz`;
    btn.setAttribute('aria-label', `Play reference tone: string ${s.num}, ${s.name}`);
    btn.addEventListener('click', () => engine.tone(s.midi));
    el.strings.append(btn);
    return btn;
  });

  let stream = null;
  let source = null;
  let analyser = null;
  let buf = null;
  let raf = null;
  let lastRun = 0;
  let lastHeard = 0;
  let history = [];

  // Skip no-op writes so the live status isn't re-announced by screen readers.
  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };

  function showIdle(message) {
    setText(el.note, '–');
    setText(el.freq, '');
    el.needle.style.left = '50%';
    el.needle.dataset.state = '';
    setText(el.status, message);
    stringBtns.forEach((b) => b.classList.remove('active'));
  }

  function showReading(freq) {
    const { string, cents } = nearestString(freq);
    const inTune = Math.abs(cents) <= IN_TUNE_CENTS;
    setText(el.note, string.name);
    setText(el.freq, `String ${string.num} · ${freq.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`);
    el.needle.style.left = 50 + Math.max(-50, Math.min(50, cents)) + '%';
    el.needle.dataset.state = inTune ? 'ok' : 'off';
    setText(el.status, inTune ? 'In tune' : cents < 0 ? 'Flat: tighten the string' : 'Sharp: loosen the string');
    stringBtns.forEach((b, i) => b.classList.toggle('active', TUNER_STRINGS[i] === string));
  }

  // Analyse every ~25 ms and smooth over only three readings, so the needle
  // follows the pitch closely while you turn the tuning peg.
  const HOP_MS = 25;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastRun < HOP_MS) return;
    lastRun = now;
    analyser.getFloatTimeDomainData(buf);
    const r = detectPitch(buf, engine.ctx.sampleRate, MAX_HZ, TUNER_MIN_RMS);
    if (r) {
      lastHeard = now;
      const prev = history.length ? history[history.length - 1] : null;
      if (prev && Math.abs(1200 * Math.log2(r.freq / prev)) > 80) history = []; // new string plucked
      history.push(r.freq);
      if (history.length > 3) history.shift();
      const sorted = history.slice().sort((x, y) => x - y);
      showReading(sorted[sorted.length >> 1]);
      return;
    }
    // No clear pitch (string too quiet, or the pitch is changing fast). Keep the
    // last reading but dim it, and only give up after a couple of seconds.
    const quiet = now - lastHeard;
    if (quiet > 2500) {
      history = [];
      showIdle('Pluck a string');
    } else if (quiet > 300 && el.needle.dataset.state) {
      el.needle.dataset.state = 'stale';
      setText(el.status, 'Listening… pluck again if the needle has stopped');
    }
  }

  async function start() {
    el.error.textContent = '';
    if (typeof PlayAlong !== 'undefined') PlayAlong.stop(); // only one thing can use the mic
    if (!navigator.mediaDevices?.getUserMedia) {
      el.error.textContent = 'This browser does not allow microphone access here. Try Chrome, Edge or Firefox over https or localhost.';
      return;
    }
    // The backing band would be picked up as noise.
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
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
    source.connect(analyser); // not routed to the speakers, so no feedback
    history = [];
    lastHeard = 0;
    el.toggle.setAttribute('aria-pressed', 'true');
    el.toggle.textContent = 'Stop tuner';
    showIdle('Pluck a string');
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = null;
    if (source) source.disconnect();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    source = analyser = stream = null;
    el.toggle.setAttribute('aria-pressed', 'false');
    el.toggle.textContent = 'Start tuner';
    showIdle('Tuner is off');
  }

  el.toggle.addEventListener('click', () => (stream ? stop() : start()));
  showIdle('Tuner is off');
  window.Tuner = { stop, isOn: () => !!stream };
})();
