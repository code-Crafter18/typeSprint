export const MAX_SPRINT_SECONDS = 3600;
export const MAX_SPRINT_CHARACTERS = 10000;
export const MAX_SERIES_POINTS = 600;

export function matchCharacters(words, typedWords, completed = false) {
  const counts = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  typedWords.forEach((value, index) => {
    const expected = Array.from(words[index] ?? "");
    const typed = Array.from(value);
    const overlap = Math.min(expected.length, typed.length);
    for (let i = 0; i < overlap; i++) {
      counts[typed[i] === expected[i] ? "correct" : "incorrect"]++;
    }
    counts.extra += Math.max(0, typed.length - expected.length);

    const submitted = index < typedWords.length - 1;
    if (submitted || completed) {
      counts.missed += expected.length - overlap;
    }
    if (submitted && index < words.length - 1) {
      counts.correct++;
    }
  });
  return counts;
}

export function sprintSpeed(characters, seconds) {
  return Math.min(10000, Math.round(characters * 12 / Math.max(0.5, seconds)));
}

export function scoreSprint(keystrokes, attempts, seconds, wpmData) {
  const elapsed = Math.min(MAX_SPRINT_SECONDS, Math.max(0.5, seconds));
  const total = attempts.correct + attempts.incorrect;
  const speeds = wpmData.map(({ wpm }) => wpm);
  const mean = speeds.length ? speeds.reduce((sum, wpm) => sum + wpm, 0) / speeds.length : 0;
  const variation = mean
    ? Math.sqrt(speeds.reduce((sum, wpm) => sum + (wpm - mean) ** 2, 0) / speeds.length) / mean
    : 0;

  return {
    wpm: sprintSpeed(keystrokes.correct, elapsed),
    raw_wpm: sprintSpeed(total, elapsed),
    accuracy: total ? Math.round(attempts.correct / total * 1000) / 10 : 0,
    errors: keystrokes.incorrect + keystrokes.extra + keystrokes.missed,
    time: Math.round(elapsed * 100) / 100,
    consistency: Math.max(0, Math.round(100 - variation * 100)),
    keystrokes,
    wpmData,
  };
}
