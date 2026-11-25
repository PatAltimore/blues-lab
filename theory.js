// Music theory data for the 12-bar blues trainer. Plain globals (no modules)
// so the app works when index.html is opened straight from disk.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Keys offered, as pitch classes. All use only natural-note chords (I7, IV7, V7).
const KEYS = { E: 4, A: 9, G: 7, C: 0, D: 2 };

// Progressions: one [semitone offset from the key root, chord quality] per bar.
// Quality is 'dom' (dominant 7th) or 'min' (minor 7th).
const D = 'dom';
const M = 'min';
const PROGRESSIONS = {
  // I I I I | IV IV I I | V IV I V (last bar is the turnaround)
  standard: {
    name: '12-bar blues',
    numerals: { 0: 'I', 5: 'IV', 7: 'V' },
    bars: [[0, D], [0, D], [0, D], [0, D], [5, D], [5, D], [0, D], [0, D], [7, D], [5, D], [0, D], [7, D]],
  },
  // Same, but jumps to the IV chord in bar 2 ("quick change").
  quick: {
    name: 'Quick-change 12-bar',
    numerals: { 0: 'I', 5: 'IV', 7: 'V' },
    bars: [[0, D], [5, D], [0, D], [0, D], [5, D], [5, D], [0, D], [0, D], [7, D], [5, D], [0, D], [7, D]],
  },
  // i i i i | iv iv i i | bVI V i V
  minor: {
    name: 'Minor blues',
    numerals: { 0: 'i', 5: 'iv', 8: '♭VI', 7: 'V' },
    bars: [[0, M], [0, M], [0, M], [0, M], [5, M], [5, M], [0, M], [0, M], [8, D], [7, D], [0, M], [7, D]],
  },
};

// Open-string MIDI notes, 1st (high e) -> 6th (low E).
const OPEN_STRINGS = [64, 59, 55, 50, 45, 40];
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
const MAX_FRET = 15;

const PENT_MINOR = [0, 3, 5, 7, 10]; // R b3 4 5 b7
const BLUE_NOTE = 6; // b5

// Minor pentatonic "boxes" as fret windows relative to the root's fret on the
// low E string. Verified against the E minor pentatonic positions 1-5.
const BOXES = { 1: [0, 3], 2: [2, 5], 3: [4, 8], 4: [7, 10], 5: [9, 12] };

function chordName(pc, quality = 'dom') {
  return NOTE_NAMES[pc] + (quality === 'min' ? 'm7' : '7');
}

// Intervals above the root: root, 3rd (major for dominant, minor for minor 7th), 5th, flat 7th.
function chordIntervals(quality = 'dom') {
  return [0, quality === 'min' ? 3 : 4, 7, 10];
}

function chordTones(pc, quality = 'dom') {
  return chordIntervals(quality).map((i) => (pc + i) % 12);
}

function chordAt(keyPc, bar, prog = 'standard') {
  const p = PROGRESSIONS[prog];
  const [offset, quality] = p.bars[bar];
  const pc = (keyPc + offset) % 12;
  return { offset, quality, pc, numeral: p.numerals[offset], name: chordName(pc, quality), tones: chordTones(pc, quality) };
}

// Beginner-friendly shapes. frets/fingers run 6th string -> 1st string.
// fret -1 = muted, 0 = open.
const SHAPES = {
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  F7: { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
  Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
};

// Diagram for any dominant or minor 7th chord: an open shape if we have one,
// otherwise a movable barre shape (root on the 6th or 5th string, whichever is lower).
function chordShape(pc, quality = 'dom') {
  const known = SHAPES[chordName(pc, quality)];
  if (known) return known;
  const e = (pc - 4 + 12) % 12; // fret of the root on the 6th string
  const a = (pc - 9 + 12) % 12; // fret of the root on the 5th string
  const dom = quality !== 'min';
  if (e <= a) {
    return {
      frets: dom ? [e, e + 2, e, e + 1, e, e] : [e, e + 2, e, e, e, e],
      fingers: dom ? [1, 3, 1, 2, 1, 1] : [1, 3, 1, 1, 1, 1],
      barre: { fret: e, from: 0, to: 5 },
    };
  }
  return {
    frets: dom ? [-1, a, a + 2, a, a + 2, a] : [-1, a, a + 2, a, a + 1, a],
    fingers: dom ? [0, 1, 3, 1, 4, 1] : [0, 1, 3, 1, 2, 1],
    barre: { fret: a, from: 1, to: 5 },
  };
}

// Scales for the jam sandbox. Intervals are semitones above the key root.
const SCALES = {
  minor: { name: 'Minor pentatonic', rel: PENT_MINOR },
  blues: { name: 'Blues scale', rel: [0, 3, 5, 6, 7, 10] },
  major: { name: 'Major pentatonic', rel: [0, 2, 4, 7, 9] },
  follow: { name: 'Follow the chords' },
};

// Pitch classes of the scale to play over `chord`. "Follow the chords" builds
// a pentatonic on the chord's own root (major over dominant, minor over minor),
// so the safe notes move whenever the chord changes.
function scalePcs(kind, keyPc, chord) {
  if (kind === 'follow') {
    const rel = chord.quality === 'min' ? PENT_MINOR : SCALES.major.rel;
    return rel.map((i) => (chord.pc + i) % 12);
  }
  return SCALES[kind].rel.map((i) => (keyPc + i) % 12);
}

// Fret ranges to show for a pentatonic box, or null for "all". The box also
// repeats an octave up/down where it fits on the neck.
function boxRanges(keyPc, box) {
  if (box === 'all') return null;
  const r = (keyPc - 4 + 12) % 12; // root fret on the low E string
  const [a, b] = BOXES[box];
  let lo = r + a;
  let hi = r + b;
  while (hi > MAX_FRET) {
    lo -= 12;
    hi -= 12;
  }
  return [-1, 0, 1].map((k) => [lo + 12 * k, hi + 12 * k]);
}

function inRanges(fret, ranges) {
  return !ranges || ranges.some(([lo, hi]) => fret >= lo && fret <= hi);
}

const TIPS = {
  I: (root) => `Home base. Any note of the scale works here, and ending a phrase on ${root} always sounds finished.`,
  IV: (root) => `The chord just changed but your scale hasn't. Try landing on ${root} to make the change audible.`,
  V: (root) => `The tension chord. Phrases that rest on ${root} here pull strongly back toward home.`,
};
TIPS.i = TIPS.I;
TIPS.iv = TIPS.IV;
TIPS['♭VI'] = (root) => `A step away from the usual changes. Landing on ${root} here sounds dark and dramatic.`;

// One suggestion per chorus in the jam sandbox; they repeat after the last one.
const JAM_PROMPTS = [
  'Warm up: play only the root notes (orange) as the chords change.',
  'Play two-note phrases and leave a gap after each one.',
  'Land on a green note (a chord tone) on the first beat of every new chord.',
  'Call and response: play for two bars, then rest for two.',
  'Pick one short phrase and repeat it all the way through. Repetition sounds deliberate.',
  'Free play. Start low and finish high, using the blue note only as a passing note.',
];
