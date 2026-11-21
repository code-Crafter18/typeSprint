import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./typingtest.css";
import { SettingsBar } from "./SettingBar.jsx";
import { CodePassage } from "./components/CodePassage.jsx";
import { AccountAction } from "./components/AccountAction.jsx";
import codePassages from "./data/codePassages.json";
import {
  CODE_LANGUAGES, isCodePassage, pickCodePassage, codeTypingTarget,
  appendCodeInput, matchCodeCharacters,
} from "./utils/codeTyping.mjs";
import { soundEngine } from "./utils/sound.js";
import { apiRequest } from "./api.js";
import {
  matchCharacters, scoreSprint, sprintSpeed, MAX_SPRINT_SECONDS,
  MAX_SPRINT_CHARACTERS, MAX_SERIES_POINTS,
} from "./utils/scoring.mjs";

const FALLBACK_WORDS = "the quick brown fox jumps over the lazy dog and runs across the field".split(" ");

function fallbackWords(count, punctuation, numbers) {
  return Array.from({ length: count }, (_, index) => {
    const word = numbers && index % 7 === 2
      ? String(index + 10)
      : FALLBACK_WORDS[index % FALLBACK_WORDS.length];
    return punctuation && index % 8 === 7 ? word + "." : word;
  });
}

function passageWords(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("The server returned an empty passage.");
  return text.trim().split(/\s+/);
}

function sampleSeries(samples, field) {
  const points = Array.from(samples, ([time, value]) => ({ time, [field]: value }));
  if (points.length <= MAX_SERIES_POINTS) return points;
  const size = Math.ceil(points.length / MAX_SERIES_POINTS);
  const combined = [];
  for (let index = 0; index < points.length; index += size) {
    const group = points.slice(index, index + size);
    const last = group.at(-1);
    combined.push(field === "count"
      ? { time: last.time, count: group.reduce((sum, point) => sum + point.count, 0) }
      : last);
  }
  return combined;
}

function newRun() {
  return {
    start: null,
    finished: false,
    typed: "",
    attempts: { correct: 0, incorrect: 0 },
    wpm: new Map(),
    errors: new Map(),
  };
}

export function TypingTest({ auth, onResult }) {
  const [wordsList, setWordsList] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => soundEngine.enabled);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [punctuation, setPunctuation] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [testMode, setTestMode] = useState("words");
  const [codeLanguage, setCodeLanguage] = useState("all");
  const [codePassage, setCodePassage] = useState(null);
  const [testDuration, setTestDuration] = useState(15);
  const [wordCount, setWordCount] = useState(25);
  const [timeLeft, setTimeLeft] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const inputRef = useRef(null);
  const wordRefs = useRef([]);
  const runRef = useRef(newRun());
  const timerRef = useRef(null);
  const passageRef = useRef(null);
  const initialWordsRef = useRef([]);
  const wordsRef = useRef([]);
  const refillRef = useRef(null);
  const saveRef = useRef(null);
  const composingRef = useRef(false);
  const navigate = useNavigate();

  const typedWords = userInput.split(" ");
  const currentWordIndex = typedWords.length - 1;
  const codeTarget = codePassage ? codeTypingTarget(codePassage.text) : "";
  const currentLine = userInput.split("\n").length;
  const codeLineCount = codeTarget.split("\n").length;

  useLayoutEffect(() => {
    if (testMode === "code") return;
    const word = wordRefs.current[currentWordIndex];
    const update = () => setScrollOffset(Math.max(0, (word?.offsetTop ?? 0) - 48));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [currentWordIndex, testMode, wordsList]);

  const startTest = useCallback(({ regenerate = false, previousTitle = "" } = {}) => {
    onResult(null);
    passageRef.current?.abort();
    refillRef.current?.abort();
    refillRef.current = null;
    clearInterval(timerRef.current);
    runRef.current = newRun();
    setRunning(false);
    composingRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
    setUserInput("");
    setScrollOffset(0);
    setTimeLeft(testDuration);
    setErrorMessage("");

    if (!regenerate && initialWordsRef.current.length) {
      wordsRef.current = initialWordsRef.current;
      setWordsList(initialWordsRef.current);
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    wordsRef.current = [];
    initialWordsRef.current = [];
    setWordsList([]);
    setCodePassage(null);
    const controller = new AbortController();
    passageRef.current = controller;
    const params = new URLSearchParams({
      testMode, punctuation, numbers, wordCount, testDuration,
    });

    if (testMode === "code") {
      params.set("language", codeLanguage);
      if (previousTitle) params.set("previousTitle", previousTitle);
    }

    const show = (words) => {
      if (controller.signal.aborted) return;
      wordsRef.current = words;
      initialWordsRef.current = words;
      setWordsList(words);
      setLoading(false);
    };

    const showCode = (passage) => {
      if (controller.signal.aborted) return;
      setCodePassage(passage);
      show([passage.text]);
    };

    apiRequest("/api/text?" + params, { signal: controller.signal })
      .then((passage) => {
        if (testMode !== "code") {
          show(passageWords(passage.text));
        } else {
          if (!isCodePassage(passage) || (codeLanguage !== "all" && passage.language !== codeLanguage)) {
            throw new Error("Invalid code passage");
          }
          showCode(passage);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setErrorMessage("The server is unavailable. Using an offline passage.");
        if (testMode === "code") {
          showCode(pickCodePassage(codePassages, codeLanguage, previousTitle));
        } else if (testMode === "quote") {
          show(passageWords("The only way to do great work is to love what you do. - Steve Jobs"));
        } else {
          const count = testMode === "time" ? Math.max(50, Math.floor(testDuration * 3.5)) : wordCount;
          show(fallbackWords(count, punctuation, numbers));
        }
      });
  }, [codeLanguage, numbers, onResult, punctuation, testDuration, testMode, wordCount]);

  useEffect(() => {
    startTest({ regenerate: true });
    return () => {
      passageRef.current?.abort();
      refillRef.current?.abort();
      clearInterval(timerRef.current);
    };
  }, [startTest]);

  useEffect(() => () => {
    saveRef.current?.abort();
    saveRef.current = null;
  }, []);

  const appendMoreWords = () => {
    if (refillRef.current) return;
    const controller = new AbortController();
    refillRef.current = controller;
    const params = new URLSearchParams({ testMode: "words", wordCount: 35, punctuation, numbers });
    const append = (words) => {
      if (controller.signal.aborted) return;
      wordsRef.current = [...wordsRef.current, ...words];
      setWordsList(wordsRef.current);
    };
    apiRequest("/api/text?" + params, { signal: controller.signal })
      .then(({ text }) => append(passageWords(text)))
      .catch(() => append(fallbackWords(35, punctuation, numbers)))
      .finally(() => {
        if (refillRef.current === controller) refillRef.current = null;
      });
  };

  const countTyped = (input, completed) => codePassage
    ? matchCodeCharacters(codeTarget, input)
    : matchCharacters(wordsRef.current, input.split(" "), completed);

  const finishTest = async (elapsed, completed = false) => {
    const run = runRef.current;
    if (run.finished) return;
    run.finished = true;
    setRunning(false);
    setSaving(true);
    clearInterval(timerRef.current);
    refillRef.current?.abort();

    const keystrokes = countTyped(run.typed, completed);
    run.wpm.set(Math.ceil(elapsed), sprintSpeed(keystrokes.correct, elapsed));
    const wpmData = sampleSeries(run.wpm, "wpm");
    const errorData = sampleSeries(run.errors, "count");
    const config = testMode === "time" ? testDuration + "s"
      : testMode === "words" ? wordCount + " words"
        : codePassage ? CODE_LANGUAGES[codePassage.language] + " · " + codePassage.title : testMode;
    const local = {
      ...scoreSprint(keystrokes, run.attempts, elapsed, wpmData),
      errorData,
      mode: testMode,
      config,
      saved: false,
    };
    const controller = new AbortController();
    saveRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    let result;
    try {
      result = await apiRequest("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keystrokes, attempts: run.attempts, timeElapsed: elapsed, wpmData, errorData,
          testMode, testConfig: config,
        }),
        signal: controller.signal,
      });
    } catch {
      result = { ...local, errorMessage: "The server did not confirm the result. Showing your local score." };
    } finally {
      clearTimeout(timeout);
    }
    if (saveRef.current !== controller) return;
    onResult(result);
    navigate("/results");
  };

  const handleTyping = (event) => {
    if (composingRef.current) return;
    const input = event.currentTarget;
    const run = runRef.current;
    const before = run.typed;
    const after = codePassage ? input.value : input.value.replace(/\n/g, " ");
    const words = wordsRef.current;
    if (!words.length || run.finished || after.length > MAX_SPRINT_CHARACTERS ||
      (!after.startsWith(before) && !before.startsWith(after))) {
      input.value = before;
      return;
    }
    const now = performance.now();
    const limit = testMode === "time" ? testDuration : MAX_SPRINT_SECONDS;
    if (run.start !== null && now - run.start >= limit * 1000) {
      input.value = before;
      finishTest(limit);
      return;
    }

    if (before.startsWith(after)) {
      run.typed = after;
      setUserInput(after);
      if (after !== before) soundEngine.playKeyClick(true);
      return;
    }

    const startRun = () => {
      if (run.start !== null) return;

      run.start = now;
      setRunning(true);
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - run.start) / 1000;
        if (testMode === "time") setTimeLeft(Math.max(0, testDuration - Math.floor(elapsed)));
        if (elapsed >= limit) {
          finishTest(limit);
          return;
        }
        const seconds = Math.floor(elapsed);
        if (seconds > 0 && !run.wpm.has(seconds)) {
          run.wpm.set(seconds, sprintSpeed(countTyped(run.typed).correct, elapsed));
        }
      }, 125);
    };

    const recordAttempt = (correct, separator) => {
      run.attempts[correct ? "correct" : "incorrect"]++;
      if (correct) {
        soundEngine.playKeyClick(separator);
      } else {
        const bucket = Math.ceil((now - run.start) / 1000);
        run.errors.set(bucket, (run.errors.get(bucket) || 0) + 1);
        soundEngine.playError();
      }
    };

    if (codePassage) {
      const { typed, attempts, completed } = appendCodeInput(codeTarget, before, after.slice(before.length));
      if (attempts.length) {
        startRun();
        for (const { correct, separator } of attempts) recordAttempt(correct, separator);
      }
      run.typed = typed;
      if (input.value !== typed) input.value = typed;
      setUserInput(typed);
      if (completed) finishTest(Math.max(0.5, (now - run.start) / 1000), true);
      return;
    }

    const typed = before.split(" ");
    let completed = false;
    for (const character of Array.from(after.slice(before.length))) {
      const index = typed.length - 1;
      const word = typed[index];
      const expected = words[index];
      const separator = character === " ";
      if (separator && !word) continue;
      if (separator && index === words.length - 1) {
        completed = testMode !== "time";
        break;
      }

      startRun();
      recordAttempt(separator || Array.from(expected)[Array.from(word).length] === character, separator);

      if (separator) typed.push("");
      else typed[index] += character;
      if (testMode !== "time" && index === words.length - 1 &&
        Array.from(typed[index]).length >= Array.from(expected).length) {
        completed = true;
        break;
      }
    }

    run.typed = typed.join(" ");
    input.value = run.typed;
    setUserInput(run.typed);
    if (completed) {
      finishTest(Math.max(0.5, (now - run.start) / 1000), true);
    } else if (testMode === "time" && typed.length >= words.length - 11) {
      appendMoreWords();
    }
  };

  const handleSoundToggle = () => setSoundEnabled(soundEngine.toggleSound());

  return (
    <div className={running ? "sprint-page is-running" : "sprint-page"}>
      {/* Top Navbar */}
      <header className="sprint-nav">
        <div className="nav-brand">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#e2b714">
            <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
          </svg>
          <span className="brand-text">TypeSprint</span>
        </div>

        <div className="nav-links">
          <Link to="/history" className="nav-link-btn" title="View Progress & History">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
            <span>History</span>
          </Link>
          <AccountAction auth={auth} />
        </div>
      </header>

      {/* Settings Bar */}
      <SettingsBar
        disabled={saving}
        punctuation={punctuation}
        numbers={numbers}
        soundEnabled={soundEnabled}
        testMode={testMode}
        testDuration={testDuration}
        wordCount={wordCount}
        codeLanguage={codeLanguage}
        onCodeLanguage={setCodeLanguage}
        onPunctuation={() => setPunctuation((p) => !p)}
        onNumbers={() => setNumbers((n) => !n)}
        onSoundToggle={handleSoundToggle}
        onTestMode={(m) => setTestMode(m)}
        onDuration={(d) => setTestDuration(d)}
        onWordCount={(c) => setWordCount(c)}
      />

      {/* Main Typing Arena */}
      <main className="typing-arena">
        {errorMessage && (
          <div className="error-banner" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {/* Live Indicator (Timer or Word Progress) */}
        <div className="live-status-bar" aria-hidden={loading}>
          {testMode === "time" ? (
            <span className="status-counter timer-counter" role="timer" aria-label="Time remaining">
              {timeLeft}s
            </span>
          ) : codePassage ? (
            <span className="status-counter code-counter" role="progressbar" aria-label="Code progress"
              aria-valuenow={currentLine} aria-valuemax={codeLineCount}>
              Line {currentLine} / {codeLineCount}
            </span>
          ) : (
            <span
              className="status-counter words-counter"
              role="progressbar"
              aria-label="Word progress"
              aria-valuenow={currentWordIndex}
              aria-valuemax={wordsList.length || 1}
              aria-valuetext={currentWordIndex + " of " + wordsList.length + " words"}
            >
              {currentWordIndex} / {wordsList.length}
            </span>
          )}
        </div>

        {codePassage && <h2 className="code-exercise-title">
          {codePassage.title} <span>{CODE_LANGUAGES[codePassage.language]}</span>
        </h2>}
        {/* Typing passage */}
        {loading ? (
          <div className="loading-sentence">Preparing sprint text...</div>
        ) : (
          <div className={codePassage ? "typing-viewport code-viewport" : "typing-viewport"}
            onClick={codePassage ? () => inputRef.current?.focus({ preventScroll: true }) : undefined}>
            <textarea
              ref={inputRef}
              className="typing-input"
              aria-label="Type the sprint passage"
              aria-describedby="sprint-passage sprint-input-help"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              disabled={saving}
              onChange={handleTyping}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(event) => { composingRef.current = false; handleTyping(event); }}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
              onSelect={(event) => {
                const input = event.currentTarget;
                if (!composingRef.current && input.selectionStart === input.selectionEnd && input.selectionEnd !== input.value.length) {
                  input.setSelectionRange(input.value.length, input.value.length);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || composingRef.current) return;
                event.preventDefault();
                startTest();
              }}
            />
            <span className="typing-reader-text" id="sprint-passage">{codePassage?.text ?? wordsList.join(" ")}</span>
            {codePassage ? <CodePassage source={codePassage.text} typed={userInput} /> : (
              <div
                className="words-flow-container"
                aria-hidden="true"
                style={{ transform: `translateY(-${scrollOffset}px)` }}
              >
                {wordsList.map((word, wi) => {
                  const expectedChars = Array.from(word);
                  const entered = Array.from(typedWords[wi] || "");
                  const typedWord = entered.slice(0, expectedChars.length);
                  const buffer = entered.slice(expectedChars.length, expectedChars.length + 8);
                  const isCurrentWord = wi === currentWordIndex;
                  const isPastWord = wi < currentWordIndex;

                  return (
                    <span
                      key={wi}
                      ref={(el) => { wordRefs.current[wi] = el; }}
                      className={`word-token ${isCurrentWord ? "active-word" : ""} ${
                        isPastWord ? "completed-word" : ""
                      }`}
                    >
                      {/* Word Characters */}
                      {expectedChars.map((char, ci) => {
                        const typedChar = typedWord[ci];
                        let statusClass = "untyped";

                        if (typedChar !== undefined) {
                          statusClass = typedChar === char ? "correct" : "incorrect";
                        }

                        const showCaretHere = isCurrentWord && ci === typedWord.length && buffer.length === 0;

                        return (
                          <span key={ci} className={`char-span ${statusClass}`}>
                            {showCaretHere && <span className="caret-cursor" />}
                            {char}
                          </span>
                        );
                      })}

                      {/* Buffer / Overflow characters */}
                      {buffer.length > 0 && (
                        <span className="buffer-span">
                          {isCurrentWord && typedWord.length === expectedChars.length && (
                            <span className="caret-cursor buffer-caret" />
                          )}
                          {buffer.map((b, bi) => (
                            <span key={bi} className="char-span extra-char">
                              {b}
                            </span>
                          ))}
                        </span>
                      )}

                      {/* End of word caret when word is typed completely */}
                      {isCurrentWord && typedWord.length === expectedChars.length && buffer.length === 0 && (
                        <span className="caret-cursor end-caret" />
                      )}

                      <span className="word-spacer">&nbsp;</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Restart Action & Keyboard Shortcut Hint */}
        <div className="restart-controls">
          {codePassage && (
            <button type="button" className="code-next" disabled={saving}
              onClick={() => startTest({ regenerate: true, previousTitle: codePassage.title })}>
              Next snippet
            </button>
          )}
          <button type="button" onClick={() => startTest()} className="restart-btn" aria-label="Restart sprint" disabled={loading || saving}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
            </svg>
          </button>
          <div className="shortcut-tip" id="sprint-input-help" role={saving ? "status" : undefined}>
            {saving ? "Finishing sprint…" : codePassage
              ? <>Type to match the code. Press <kbd>enter</kbd> at the end of each line. Indentation is provided.</>
              : <>Tap or click the passage to type. Press <kbd>esc</kbd> in the passage to restart.</>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default TypingTest;
