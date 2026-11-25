# Blues Lab

A web app that helps a beginner learn to play blues guitar. It runs entirely in the browser, with no build step and no backend.

**Live demo: https://pataltimore.github.io/blues-lab/**

## What's in it

- **Course:** 13 short lessons, from tuning up to chords, the shuffle rhythm, pentatonic Box 1, phrasing, the blue note and a jam session. Completion and a practice streak are saved in your browser.
- **Backing band:** a synthesized drum, bass and chord band playing a 12-bar blues in E, A, G, C or D. Choose the tempo, progression (12-bar, quick-change or minor blues) and feel (shuffle or straight), and mute any instrument.
- **Jam sandbox:** improvise over the band. It shows which notes are safe over the current chord, previews the next chord change, and gives a new suggestion each chorus.
- **Current chord:** a chord diagram, the chord's notes and a tip for where you are in the progression.
- **Fretboard:** an interactive fretboard showing the minor pentatonic boxes, the blue note or the current chord's notes. Click any note to hear it.
- **Play-along:** a lick scrolls past as tab and the microphone listens as you play single notes, scoring the note and its timing.
- **Tuner:** a microphone tuner for standard tuning, with reference tones for each string.

## Running it

There is nothing to install. Open `index.html` in a recent Chrome, Edge or Firefox.

The tuner and play-along use the microphone, which browsers only allow on `https` or `localhost`. To use them locally, serve the folder:

```
python -m http.server 8123
```

Then visit http://localhost:8123/. Use headphones with the play-along so its count-in clicks don't reach the microphone.

## How it's put together

Plain JavaScript files loaded with script tags, sharing globals.

| File | Purpose |
| --- | --- |
| `theory.js` | Notes, keys, progressions, chord shapes, scales, lesson tips |
| `audio.js` | Web Audio band, scheduler, click and reference tones |
| `fretboard.js` | SVG fretboard and chord diagram |
| `app.js` | Page state, controls, 12-bar grid, chord panel |
| `jam.js` | Jam sandbox |
| `tuner.js` | Pitch detection and the tuner |
| `playalong.js` | Scrolling tab and note scoring |
| `course.js` | Lessons and progress tracking |

## License

[MIT](LICENSE)
