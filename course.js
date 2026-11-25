// Beginner course: ordered lessons, completion tracking and a practice streak,
// saved in localStorage (the app still works if storage is unavailable).

const LESSONS = [
  {
    id: 'tune-up',
    title: 'Tune your guitar',
    goal: 'Get all six strings in tune before you play anything.',
    steps: [
      'Press Start tuner and allow microphone access. Pluck the thickest string (low E) on its own and let it ring.',
      'If the needle is left of centre the string is flat, so tighten its tuning peg slightly. If it is right of centre it is sharp, so loosen it. Aim for "In tune".',
      'Tune up to the note rather than down: if you overshoot, drop below it and come up again. Then tune A, D, G, B and the high e.',
      'Go back to the low E at the end, since adjusting the other strings can shift it. Tap a string in the tuner to hear its reference pitch.',
    ],
    done: 'All six open strings read "In tune".',
    preset: null, // opens the tuner instead of setting up the band
  },
  {
    id: 'hear-12-bars',
    title: 'Hear the 12 bars',
    goal: 'Recognise the 12-bar blues cycle by ear.',
    steps: [
      'Press Play and watch the grid. Count 1-2-3-4 in every bar.',
      'Listen for the chord change at bar 5 (the sound lifts) and again at bar 9 (the tension chord).',
      'Clap on beats 2 and 4, the backbeat, for one whole cycle.',
    ],
    done: 'You can say which bar you are in without looking at the grid.',
    preset: { key: 'E', bpm: 70, view: 'chord', box: 'all', blue: true },
  },
  {
    id: 'e7',
    title: 'Your first chord: E7',
    goal: 'Fret and strum a clean E7.',
    steps: [
      'Copy the diagram: 2nd finger on the A string (2nd fret), 1st finger on the G string (1st fret). Leave the other strings open.',
      'Strum all six strings, then pick them one at a time. Adjust until none buzz or are muted.',
      'Strum one downstroke on every beat during bars 1-4 while the band plays.',
    ],
    done: 'You can play E7 cleanly for four bars in a row.',
    preset: { key: 'E', bpm: 65, view: 'chord', box: 'all', blue: true },
  },
  {
    id: 'a7-b7',
    title: 'A7 and B7',
    goal: 'Learn the other two chords of the blues.',
    steps: [
      'A7: 2nd finger on the D string (2nd fret), 3rd finger on the B string (2nd fret). Don\'t play the low E string.',
      'B7: 2nd finger on the A string (2nd fret), 1st finger on the D string (1st fret), 3rd finger on the G string (2nd fret), 4th finger on the high E string (2nd fret).',
      'Practise changing E7 to A7 and back to E7 on the beat, with no strumming in between if you need the time.',
    ],
    done: 'You can switch E7 to A7 to E7 without stopping the beat.',
    preset: { key: 'E', bpm: 60, view: 'chord', box: 'all', blue: true },
  },
  {
    id: 'play-12-bars',
    title: 'Play all 12 bars',
    goal: 'Strum along with one complete chorus.',
    steps: [
      'Press Play at a slow tempo and strum one downstroke per beat, changing chords with the highlighted bar.',
      'If you lose your place, stop strumming, wait for bar 1, and join in again.',
      'Aim for one whole chorus without losing the beat. Missing a chord change is fine, so keep going.',
    ],
    done: 'You played all 12 bars in time, even if some chords were late.',
    preset: { key: 'E', bpm: 60, view: 'chord', box: 'all', blue: true },
  },
  {
    id: 'shuffle',
    title: 'The shuffle feel',
    goal: 'Strum with the swung, triplet rhythm of the blues.',
    steps: [
      'Count each beat in three: "1-trip-let, 2-trip-let". The band plays on the "1" and the "let" and skips the middle.',
      'Strum down on the beat and up on the "let", missing the strum on "trip". It should sound like a skipping "dum-da, dum-da".',
      'Keep it going over bars 1-4 on E7, then try it over the whole 12 bars.',
    ],
    done: 'Your strumming sounds like it sits inside the drums\' hi-hat pattern.',
    preset: { key: 'E', bpm: 70, view: 'chord', box: 'all', blue: true },
  },
  {
    id: 'box-1',
    title: 'Minor pentatonic: Box 1',
    goal: 'Learn the most important scale shape in blues.',
    steps: [
      'The fretboard now shows Box 1. Find the orange root note on the low E string.',
      'Play the notes string by string from the low E up to the high e, then back down. Use one finger per fret and keep your fingers close to the strings.',
      'Play along with the band, slowly, one note per beat. Every note fits all three chords.',
    ],
    done: 'You can play the box up and down without looking at the diagram.',
    preset: { key: 'E', bpm: 60, view: 'scale', box: '1', blue: false },
  },
  {
    id: 'first-phrase',
    title: 'Your first phrase',
    goal: 'Make music from a few notes instead of running the scale.',
    steps: [
      'Choose just two or three notes from Box 1. Make up a short rhythm and repeat it.',
      'End your phrase on the orange root note.',
      'Call and response: play a phrase in bars 1-2, rest in bar 3, play a different answer in bar 4. Leave space; the silence is part of it.',
    ],
    done: 'You played a phrase that you would recognise if you played it again.',
    preset: { key: 'E', bpm: 70, view: 'scale', box: '1', blue: false },
  },
  {
    id: 'blue-note',
    title: 'Add the blue note',
    goal: 'Use the note that gives the blues its sound.',
    steps: [
      'Switch the blue note on. It is the purple dot: one fret above the 4th note of the scale.',
      'Slide or hammer through it on the way between its neighbours, and never end a phrase on it.',
      'Add it to your phrase from the last lesson and listen to the difference.',
    ],
    done: 'You used the blue note as a passing note in a phrase.',
    preset: { key: 'E', bpm: 70, view: 'scale', box: '1', blue: true },
  },
  {
    id: 'follow-changes',
    title: 'Follow the changes',
    goal: 'Make your solo respond to the chord changes.',
    steps: [
      'Watch for the highlighted chord. When it moves to IV (bar 5), land on its root note while the chord is playing.',
      'Do the same for V (bar 9). The teal dots show notes that also belong to the current chord.',
      'Try playing a phrase on the I chord, then land on a teal note when the chord changes.',
    ],
    done: 'Your phrases landed on a chord note at bars 5 and 9.',
    preset: { key: 'E', bpm: 70, view: 'scale', box: '1', blue: true },
  },
  {
    id: 'new-key',
    title: 'Another key, faster',
    goal: 'Move what you know to a new key and a higher tempo.',
    steps: [
      'Switch to the key of A. The shapes are the same but start higher on the neck, so find the new root note.',
      'Play your phrases and Box 1 over the band, then increase the tempo a few BPM at a time.',
      'Try the other boxes to find the next shape up the neck.',
    ],
    done: 'You played a chorus in A at 90 BPM or faster.',
    preset: { key: 'A', bpm: 80, view: 'scale', box: '1', blue: true },
  },
];

const COURSE_KEY = 'bluesLab.course.v1';

const progress = (() => {
  let data = { done: {}, days: [], current: LESSONS[0].id };
  try {
    const saved = JSON.parse(localStorage.getItem(COURSE_KEY));
    if (saved && typeof saved === 'object') data = { ...data, ...saved };
  } catch (e) {
    /* storage unavailable or corrupt: start fresh */
  }
  const save = () => {
    try {
      localStorage.setItem(COURSE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  };
  return { data, save };
})();

function dayString(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function practiceStreak() {
  const days = new Set(progress.data.days);
  const d = new Date();
  if (!days.has(dayString(d))) d.setDate(d.getDate() - 1); // today may not be practised yet
  let n = 0;
  while (days.has(dayString(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function logPracticeDay() {
  const today = dayString();
  if (!progress.data.days.includes(today)) progress.data.days.push(today);
  progress.save();
}

const courseEl = {
  list: $('#lesson-list'),
  detail: $('#lesson-detail'),
  bar: $('#course-progress'),
  summary: $('#course-summary'),
};

function currentLesson() {
  return LESSONS.find((l) => l.id === progress.data.current) || LESSONS[0];
}

function renderCourse() {
  const doneCount = LESSONS.filter((l) => progress.data.done[l.id]).length;
  courseEl.bar.max = LESSONS.length;
  courseEl.bar.value = doneCount;
  const streak = practiceStreak();
  courseEl.summary.textContent =
    `${doneCount} of ${LESSONS.length} lessons complete` +
    (streak > 0 ? ` · ${streak}-day practice streak` : '');

  courseEl.list.replaceChildren(
    ...LESSONS.map((l, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lesson-btn';
      const isDone = !!progress.data.done[l.id];
      const isCurrent = l.id === progress.data.current;
      btn.classList.toggle('done', isDone);
      btn.setAttribute('aria-current', String(isCurrent));
      btn.innerHTML = '<span class="mark" aria-hidden="true"></span><span class="lt"></span>';
      btn.querySelector('.mark').textContent = isDone ? '✓' : String(i + 1);
      btn.querySelector('.lt').textContent = l.title;
      if (isDone) btn.querySelector('.lt').append(Object.assign(document.createElement('span'), { className: 'sr', textContent: ' (complete)' }));
      btn.addEventListener('click', () => selectLesson(l.id));
      li.append(btn);
      return li;
    })
  );

  const lesson = currentLesson();
  const idx = LESSONS.indexOf(lesson);
  const isDone = !!progress.data.done[lesson.id];
  courseEl.detail.innerHTML =
    '<h3></h3><p class="goal"></p><ol class="steps"></ol><p class="goal-done"></p>' +
    '<div class="lesson-actions">' +
    '<button type="button" class="primary" data-act="try"></button>' +
    '<button type="button" data-act="complete"></button>' +
    '</div>';
  courseEl.detail.querySelector('h3').textContent = `Lesson ${idx + 1}: ${lesson.title}`;
  courseEl.detail.querySelector('.goal').textContent = lesson.goal;
  courseEl.detail.querySelector('.steps').append(
    ...lesson.steps.map((s) => Object.assign(document.createElement('li'), { textContent: s }))
  );
  courseEl.detail.querySelector('.goal-done').textContent = 'You\'re done when: ' + lesson.done;
  courseEl.detail.querySelector('[data-act="try"]').textContent = lesson.preset
    ? 'Set up the band for this lesson'
    : 'Open the tuner';
  const completeBtn = courseEl.detail.querySelector('[data-act="complete"]');
  completeBtn.textContent = isDone ? '✓ Completed (undo)' : 'Mark complete';
  completeBtn.setAttribute('aria-pressed', String(isDone));
}

function selectLesson(id) {
  progress.data.current = id;
  progress.save();
  renderCourse();
}

courseEl.detail.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const lesson = currentLesson();
  if (act === 'try') {
    if (lesson.preset) applyPreset(lesson.preset);
    logPracticeDay();
    renderCourse();
    $(lesson.preset ? '#band-card' : '#tuner-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (act === 'complete') {
    const wasDone = !!progress.data.done[lesson.id];
    if (wasDone) delete progress.data.done[lesson.id];
    else {
      progress.data.done[lesson.id] = true;
      logPracticeDay();
      const next = LESSONS[LESSONS.indexOf(lesson) + 1];
      if (next) progress.data.current = next.id;
    }
    progress.save();
    renderCourse();
  }
});

$('#course-reset').addEventListener('click', () => {
  if (!confirm('Reset all course progress and your practice streak?')) return;
  progress.data.done = {};
  progress.data.days = [];
  progress.data.current = LESSONS[0].id;
  progress.save();
  renderCourse();
});

renderCourse();
