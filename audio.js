// Web Audio backing band: shuffle drums, walking bass and chord stabs,
// scheduled with a short lookahead so timing stays tight.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Bass line per bar, in semitones above the chord root (classic shuffle walk).
const BASS_WALK = [0, 4, 7, 9, 10, 9, 7, 4];
const STEPS_PER_BEAT = 3; // triplet grid; shuffle plays steps 0 and 2
const STEPS_PER_BAR = 4 * STEPS_PER_BEAT;
const TOTAL_STEPS = 12 * STEPS_PER_BAR;

class BluesEngine {
  constructor(getState, onTick) {
    this.getState = getState; // () => ({ keyPc, bpm })
    this.onTick = onTick; // ({ bar, beat }) or null when stopped
    this.ctx = null;
    this.playing = false;
    this.events = [];
    this.timer = null;
    this.raf = null;
    this.mix = { drums: true, bass: true, chords: true };
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.bus = {};
    for (const name of ['drums', 'bass', 'chords', 'lead']) {
      const g = ctx.createGain();
      g.gain.value = this.mix[name] === false ? 0 : 1;
      g.connect(this.master);
      this.bus[name] = g;
    }

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  setMix(name, on) {
    this.mix[name] = on;
    if (this.bus) this.bus[name].gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  async start() {
    this.init();
    await this.ctx.resume();
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.events = [];
    this.playing = true;
    this.timer = setInterval(() => this.pump(), 25);
    const frame = () => {
      let latest = null;
      while (this.events.length && this.events[0].t <= this.ctx.currentTime) latest = this.events.shift();
      if (latest) this.onTick(latest);
      if (this.playing) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.events = [];
    this.onTick(null);
  }

  pump() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += 60 / this.getState().bpm / STEPS_PER_BEAT;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  scheduleStep(step, t) {
    const { keyPc, bpm } = this.getState();
    const beatDur = 60 / bpm;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const beat = Math.floor(inBar / STEPS_PER_BEAT);
    const sub = inBar % STEPS_PER_BEAT;
    this.events.push({ t, bar, beat, sub });
    if (sub === 1) return; // the swung "skipped" triplet

    const { pc } = chordAt(keyPc, bar);

    // Drums
    if (sub === 0) {
      if (beat === 0 || beat === 2) this.kick(t);
      else this.snare(t);
    }
    this.hat(t, sub === 0 ? 0.35 : 0.18);

    // Bass: eight swung notes per bar
    const eighth = beat * 2 + (sub === 2 ? 1 : 0);
    const rootMidi = 28 + ((pc - 4 + 12) % 12); // E1..D#2
    this.voice('bass', rootMidi + BASS_WALK[eighth], t, sub === 0 ? beatDur * 0.6 : beatDur * 0.28, {
      type: 'triangle',
      gain: 0.55,
      cutoff: 700,
    });

    // Chord stabs on every beat, strongest on the backbeat (2 and 4)
    if (sub === 0) {
      const r = 52 + ((pc - 4 + 12) % 12);
      const vel = beat === 1 || beat === 3 ? 0.17 : 0.09;
      for (const iv of [0, 4, 7, 10]) {
        this.voice('chords', r + iv, t, beatDur * 0.3, { type: 'sawtooth', gain: vel, cutoff: 1800 });
      }
    }
  }

  // --- instruments -------------------------------------------------------

  voice(busName, midi, t, dur, { type, gain, cutoff }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = mtof(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 1.6, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.bus[busName]);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Single guitar-ish note for clicking the fretboard.
  async pluck(midi) {
    this.init();
    await this.ctx.resume();
    this.voice('lead', midi, this.ctx.currentTime, 1.3, { type: 'sawtooth', gain: 0.3, cutoff: 1600 });
  }

  noiseHit(t, dur, filterType, freq, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bus.drums);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g);
    g.connect(this.bus.drums);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  snare(t) {
    this.noiseHit(t, 0.16, 'bandpass', 1800, 0.55);
  }

  hat(t, gain) {
    this.noiseHit(t, 0.045, 'highpass', 7000, gain);
  }
}
