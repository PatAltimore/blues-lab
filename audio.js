// Web Audio backing band: shuffle drums, walking bass and chord stabs,
// scheduled with a short lookahead so timing stays tight.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Bass line per bar, in semitones above the chord root (classic walking line).
const BASS_WALK = {
  dom: [0, 4, 7, 9, 10, 9, 7, 4],
  min: [0, 3, 7, 9, 10, 9, 7, 3],
};
// Grid steps per beat for each feel. Shuffle uses a triplet grid and plays
// steps 0 and 2 (swung eighths); straight plays plain eighths on steps 0 and 1.
const FEELS = { shuffle: 3, straight: 2 };

class BluesEngine {
  constructor(getState, onTick) {
    this.getState = getState; // () => ({ keyPc, bpm, prog, feel })
    this.onTick = onTick; // ({ bar, beat, sub, chorus }) or null when stopped
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
    this.bar = 0;
    this.tick = 0;
    this.chorus = 0;
    this.feel = this.getState().feel;
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
      const perBeat = FEELS[this.feel];
      this.scheduleStep(this.bar, this.tick, this.nextTime);
      this.nextTime += 60 / this.getState().bpm / perBeat;
      if (++this.tick === 4 * perBeat) {
        this.tick = 0;
        this.bar = (this.bar + 1) % 12;
        if (this.bar === 0) this.chorus++;
        this.feel = this.getState().feel; // a new feel starts on the next bar
      }
    }
  }

  scheduleStep(bar, tick, t) {
    const { keyPc, bpm, prog } = this.getState();
    const beatDur = 60 / bpm;
    const shuffle = this.feel === 'shuffle';
    const perBeat = FEELS[this.feel];
    const beat = Math.floor(tick / perBeat);
    const sub = tick % perBeat;
    this.events.push({ t, bar, beat, sub, chorus: this.chorus });
    if (shuffle && sub === 1) return; // the swung "skipped" triplet

    const chord = chordAt(keyPc, bar, prog);
    const onBeat = sub === 0;

    // Drums
    if (onBeat) {
      if (beat === 0 || beat === 2) this.kick(t);
      else this.snare(t);
    }
    this.hat(t, onBeat ? 0.35 : 0.18);

    // Bass: eight notes per bar (swung or straight)
    const eighth = beat * 2 + (onBeat ? 0 : 1);
    const rootMidi = 28 + ((chord.pc - 4 + 12) % 12); // E1..D#2
    const bassDur = shuffle ? (onBeat ? beatDur * 0.6 : beatDur * 0.28) : beatDur * 0.42;
    this.voice('bass', rootMidi + BASS_WALK[chord.quality][eighth], t, bassDur, {
      type: 'triangle',
      gain: 0.55,
      cutoff: 700,
    });

    // Chord stabs on every beat, strongest on the backbeat (2 and 4)
    if (onBeat) {
      const r = 52 + ((chord.pc - 4 + 12) % 12);
      const vel = beat === 1 || beat === 3 ? 0.17 : 0.09;
      for (const iv of chordIntervals(chord.quality)) {
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

  // Steady reference tone for tuning by ear.
  async tone(midi, dur = 2.5) {
    this.init();
    await this.ctx.resume();
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.03);
    g.gain.setValueAtTime(0.35, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.bus.lead);
    osc.start(t);
    osc.stop(t + dur + 0.05);
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

  // Short noisy tick for the play-along count-in and beat. Noise rather than a
  // pure tone so the pitch detector doesn't mistake it for a played note.
  click(t, accent) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = accent ? 2600 : 1800;
    filter.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.8 : 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bus.lead);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
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
