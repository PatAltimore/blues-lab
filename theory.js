// Music theory data for the 12-bar blues trainer. Plain globals (no modules)
// so the app works when index.html is opened straight from disk.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Keys offered, as pitch classes. All use only natural-note chords (I7, IV7, V7).
const KEYS = { E: 4, A: 9, G: 7, C: 0, D: 2 };

// 12-bar blues: semitone offset of each bar's chord from the key root.
// I I I I | IV IV I I | V IV I V (last bar is the turnaround)
const PROGRESSION = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];
const NUMERALS = { 0: 'I', 5: 'IV', 7: 'V' };

// Open-string MIDI notes, 1st (high e) -> 6th (low E).
const OPEN_STRINGS = [64, 59, 55, 50, 45, 40];
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
const MAX_FRET = 15;

const PENT_MINOR = [0, 3, 5, 7, 10]; // R b3 4 5 b7
const BLUE_NOTE = 6; // b5

// Minor pentatonic "boxes" as fret windows relative to the root's fret on the
// low E string. Verified against the E minor pentatonic positions 1-5.
const BOXES = { 1: [0, 3], 2: [2, 5], 3: [4, 8], 4: [7, 10], 5: [9, 12] };

function chordName(pc) {
  return NOTE_NAMES[pc] + '7';
}

// Dominant 7th chord tones: root, major 3rd, 5th, flat 7th.
function chordTones(pc) {
  return [0, 4, 7, 10].map((i) => (pc + i) % 12);
}

function chordAt(keyPc, bar) {
  const offset = PROGRESSION[bar];
  return { offset, pc: (keyPc + offset) % 12, numeral: NUMERALS[offset] };
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
};

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
