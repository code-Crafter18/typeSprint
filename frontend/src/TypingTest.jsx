import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./typingTest.css";
import { SettingsBar } from "./SettingBar.jsx";
import { soundEngine } from "./utils/sound.js";

export function TypingTest() {
  const [sentence, setSentence] = useState("");
  const [userInput, setUserInput] = useState("");
  const [testActive, setTestActive] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [extraCharsMap, setExtraCharsMap] = useState({});
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Keystroke statistics
  const keystrokesRef = useRef({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
  const userInputRef = useRef("");
  const testActiveRef = useRef(false);

  const navigate = useNavigate();
  const [wpmData, setWpmData] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const wpmDataRef = useRef([]);
  const errorDataRef = useRef([]);
  const intervalRef = useRef(null);

  // Settings
  const [punctuation, setPunctuation] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [testMode, setTestMode] = useState("words"); // 'words', 'time', 'quote'
  const [testDuration, setTestDuration] = useState(15);
  const [wordCount, setWordCount] = useState(25);
  const [timeLeft, setTimeLeft] = useState(testDuration);
  const [loading, setLoading] = useState(true);

  const words = sentence ? sentence.split(" ") : [];

  // Synchronize refs
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  useEffect(() => {
    testActiveRef.current = testActive;
  }, [testActive]);

  // Load new sentence whenever mode or modifiers change
  useEffect(() => {
    startTest();
  }, [punctuation, numbers, testMode, testDuration, wordCount]);

  // Timer & Real-time WPM tick
  useEffect(() => {
    if (testActive && startTime) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.max(1, Math.round((now - startTime) / 1000));

        if (testMode === "time") {
          const newTimeLeft = testDuration - elapsed;
          setTimeLeft(newTimeLeft <= 0 ? 0 : newTimeLeft);
        }

        const currentTyped = userInputRef.current;
        const wordsTyped = currentTyped.length / 5;
        const liveWpm = Math.round((wordsTyped / elapsed) * 60);

        const newPoint = { time: elapsed, wpm: liveWpm };
        const updated = wpmDataRef.current.filter((p) => p.time !== elapsed).concat(newPoint);
        wpmDataRef.current = updated;
        setWpmData(updated);
      }, 1000);
    }

    return () => clearInterval(intervalRef.current);
  }, [testActive, startTime, testMode, testDuration]);

  // Handle time mode completion
  useEffect(() => {
    if (testMode === "time" && timeLeft <= 0 && testActive) {
      finishTest(userInputRef.current, testDuration);
    }
  }, [timeLeft, testMode, testActive, testDuration]);

  const calculateAndSaveResults = async (finalInput, timeElapsed) => {
    const elapsedSec = Math.max(1, Math.round(timeElapsed));
    const calculatedWpm = Math.max(0, Math.round((finalInput.length / 5) / (elapsedSec / 60)));

    // Ensure we have a valid time series for charting
    let finalWpmSeries = [...wpmDataRef.current];
    if (finalWpmSeries.length === 0) {
      finalWpmSeries = [
        { time: 1, wpm: Math.round(calculatedWpm * 0.8) },
        { time: elapsedSec, wpm: calculatedWpm },
      ];
    } else {
      const last = finalWpmSeries[finalWpmSeries.length - 1];
      if (last.time < elapsedSec) {
        finalWpmSeries.push({ time: elapsedSec, wpm: calculatedWpm });
      }
    }

    const currentErrors = [...errorDataRef.current];

    try {
      const response = await fetch("http://127.0.0.1:5000/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalUserInput: finalInput,
          timeElapsed,
          finalErrorCount: errorCount,
          wpmData: finalWpmSeries,
          errorData: currentErrors,
          keystrokes: keystrokesRef.current,
          testMode,
          testConfig: testMode === "time" ? `${testDuration}s` : `${wordCount} words`,
        }),
      });

      const serverResults = await response.json();
      const enrichedResults = {
        ...serverResults,
        wpmData: serverResults.wpmData && serverResults.wpmData.length > 0 ? serverResults.wpmData : finalWpmSeries,
        errorData: serverResults.errorData || currentErrors,
      };

      if (response.ok) {
        sessionStorage.setItem("lastSprintResults", JSON.stringify(enrichedResults));
        navigate("/results", { state: enrichedResults });
      } else {
        const fallback = {
          wpm: calculatedWpm,
          accuracy: 0,
          errors: errorCount,
          time: timeElapsed,
          wpmData: finalWpmSeries,
          errorData: currentErrors,
        };
        sessionStorage.setItem("lastSprintResults", JSON.stringify(fallback));
        navigate("/results", { state: fallback });
      }
    } catch {
      // Fallback calculation if backend unreachable
      const accuracy = Math.max(0, Math.round((1 - errorCount / Math.max(1, finalInput.length)) * 100));
      const fallbackResult = {
        wpm: calculatedWpm,
        raw_wpm: calculatedWpm,
        accuracy,
        errors: errorCount,
        time: timeElapsed,
        graph_image: null,
        wpmData: finalWpmSeries,
        errorData: currentErrors,
      };
      sessionStorage.setItem("lastSprintResults", JSON.stringify(fallbackResult));
      navigate("/results", { state: fallbackResult });
    }
  };

  const finishTest = useCallback(
    (finalInput, timeElapsed) => {
      setTestActive(false);
      clearInterval(intervalRef.current);
      calculateAndSaveResults(finalInput, timeElapsed);
    },
    [errorCount, testMode, testDuration, wordCount]
  );

  const startTest = useCallback(() => {
    setLoading(true);
    setTestActive(false);
    setUserInput("");
    setErrorCount(0);
    setExtraCharsMap({});
    setCurrentWordIndex(0);
    setStartTime(null);
    clearInterval(intervalRef.current);
    setWpmData([]);
    setErrorData([]);
    wpmDataRef.current = [];
    errorDataRef.current = [];
    setTimeLeft(testDuration);
    keystrokesRef.current = { correct: 0, incorrect: 0, extra: 0, missed: 0 };

    const params = new URLSearchParams({
      punctuation: punctuation.toString(),
      numbers: numbers.toString(),
      testMode,
      wordCount: wordCount.toString(),
      testDuration: testDuration.toString(),
    });

    fetch(`http://127.0.0.1:5000/api/text?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.text) {
          setSentence(data.text);
          setTestActive(true);
        } else {
          setSentence("the quick brown fox jumps over the lazy dog");
          setTestActive(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setSentence("the quick brown fox jumps over the lazy dog and runs across the field");
        setTestActive(true);
        setLoading(false);
      });
  }, [punctuation, numbers, testMode, wordCount, testDuration]);

  // Keyboard Handler
  useEffect(() => {
    let tabPressed = false;

    const handleKeyDown = (e) => {
      // Keyboard Shortcuts: Tab + Enter or Escape to restart test
      if (e.key === "Tab") {
        tabPressed = true;
        return;
      }
      if ((tabPressed && e.key === "Enter") || e.key === "Escape") {
        e.preventDefault();
        tabPressed = false;
        startTest();
        return;
      }
      tabPressed = false;

      if (!testActiveRef.current || (testMode === "time" && timeLeft <= 0)) return;

      const currentWord = words[currentWordIndex] || "";
      const currentInput = (userInput.split(" ")[currentWordIndex] || "");
      const isLastWord = currentWordIndex === words.length - 1;

      // Handle Backspace
      if (e.key === "Backspace") {
        const buffer = extraCharsMap[currentWordIndex] || "";

        if (buffer.length > 0) {
          setExtraCharsMap((prev) => ({
            ...prev,
            [currentWordIndex]: buffer.slice(0, -1),
          }));
          setErrorCount((prev) => Math.max(0, prev - 1));
          errorDataRef.current = errorDataRef.current.slice(0, -1);
          setErrorData(errorDataRef.current);
        } else if (currentInput.length > 0) {
          const charIndex = currentInput.length - 1;
          const charToDelete = currentInput[charIndex];
          const charCorrect = currentWord[charIndex];

          if (charToDelete !== charCorrect) {
            setErrorCount((prev) => Math.max(0, prev - 1));
            errorDataRef.current = errorDataRef.current.slice(0, -1);
            setErrorData(errorDataRef.current);
          }

          const allWords = userInput.split(" ");
          allWords[currentWordIndex] = allWords[currentWordIndex].slice(0, -1);
          setUserInput(allWords.join(" "));
        }
        soundEngine.playKeyClick(true);
        e.preventDefault();
        return;
      }

      // Ignore modifiers, arrows, F-keys, etc.
      if (e.key.length > 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      // Start timing upon first keypress
      let activeStartTime = startTime;
      if (!activeStartTime) {
        activeStartTime = new Date();
        setStartTime(activeStartTime);
        if (testMode === "time") {
          setTimeLeft(testDuration);
        }
      }

      const now = new Date();
      const elapsed = Math.max(1, Math.round((now - activeStartTime) / 1000));

      // Extra character typed on word
      if (!isLastWord && currentInput.length >= currentWord.length && e.key !== " ") {
        setExtraCharsMap((prev) => {
          const current = prev[currentWordIndex] || "";
          if (current.length >= 8) return prev;
          setErrorCount((p) => p + 1);
          errorDataRef.current = [...errorDataRef.current, { time: elapsed }];
          setErrorData(errorDataRef.current);
          keystrokesRef.current.extra += 1;
          return { ...prev, [currentWordIndex]: current + e.key };
        });
        soundEngine.playError();
        e.preventDefault();
        return;
      }

      // Space key to advance word
      if (e.key === " ") {
        if (currentInput.length === 0) {
          e.preventDefault();
          return;
        }

        if (currentWordIndex < words.length - 1) {
          if (currentInput.length < currentWord.length) {
            const skipped = currentWord.length - currentInput.length;
            setErrorCount((p) => p + skipped);
            keystrokesRef.current.missed += skipped;
            const errorEvents = Array(skipped).fill({ time: elapsed });
            errorDataRef.current = [...errorDataRef.current, ...errorEvents];
            setErrorData(errorDataRef.current);
          }

          const nextIndex = currentWordIndex + 1;
          setCurrentWordIndex(nextIndex);

          setUserInput((prev) => {
            const allWords = prev.split(" ");
            while (allWords.length <= nextIndex) {
              allWords.push("");
            }
            return allWords.join(" ");
          });
          soundEngine.playKeyClick(true);
        } else if (isLastWord && (testMode === "words" || testMode === "quote")) {
          // Space on last word completes test
          const totalElapsed = (new Date() - activeStartTime) / 1000 || 1;
          finishTest(userInput, totalElapsed);
        }
        e.preventDefault();
        return;
      }

      // Normal character typing
      const expectedChar = currentWord[currentInput.length];
      const isCorrect = expectedChar === e.key;

      if (isCorrect) {
        keystrokesRef.current.correct += 1;
        soundEngine.playKeyClick(false);
      } else {
        keystrokesRef.current.incorrect += 1;
        setErrorCount((p) => p + 1);
        errorDataRef.current = [...errorDataRef.current, { time: elapsed }];
        setErrorData(errorDataRef.current);
        soundEngine.playError();
      }

      const newTypedWord = (currentInput || "") + e.key;
      const allWords = userInput.split(" ");
      allWords[currentWordIndex] = newTypedWord;
      const newUserInput = allWords.join(" ");
      setUserInput(newUserInput);

      // End test condition for words and quote modes
      if (
        (testMode === "words" || testMode === "quote") &&
        isLastWord &&
        newTypedWord.length >= currentWord.length
      ) {
        const totalElapsed = (new Date() - activeStartTime) / 1000 || 1;
        finishTest(newUserInput, totalElapsed);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    userInput,
    currentWordIndex,
    extraCharsMap,
    words,
    testMode,
    timeLeft,
    startTime,
    testDuration,
    startTest,
    finishTest,
  ]);

  const handleSoundToggle = () => {
    const enabled = soundEngine.toggleSound();
    setSoundEnabled(enabled);
  };

  return (
    <div className="sprint-page">
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
        </div>
      </header>

      {/* Settings Bar */}
      <SettingsBar
        punctuation={punctuation}
        numbers={numbers}
        soundEnabled={soundEnabled}
        testMode={testMode}
        testDuration={testDuration}
        wordCount={wordCount}
        onPunctuation={() => setPunctuation((p) => !p)}
        onNumbers={() => setNumbers((n) => !n)}
        onSoundToggle={handleSoundToggle}
        onTestMode={(m) => setTestMode(m)}
        onDuration={(d) => setTestDuration(d)}
        onWordCount={(c) => setWordCount(c)}
      />

      {/* Main Typing Arena */}
      <main className="typing-arena">
        {/* Live Indicator (Timer or Word Progress) */}
        <div className="live-status-bar">
          {testMode === "time" ? (
            <span className="status-counter timer-counter">{timeLeft}s</span>
          ) : (
            <span className="status-counter words-counter">
              {currentWordIndex} / {words.length}
            </span>
          )}
        </div>

        {/* Text Presentation Area */}
        {loading ? (
          <div className="loading-sentence">Preparing sprint text...</div>
        ) : (
          <div className="sentence-display-box" onClick={() => window.focus()}>
            {words.map((word, wi) => {
              const typedWord = (userInput.split(" ")[wi] || "").split("");
              const buffer = extraCharsMap[wi] || "";
              const isCurrentWord = wi === currentWordIndex;
              const isPastWord = wi < currentWordIndex;

              return (
                <span
                  key={wi}
                  className={`word-token ${isCurrentWord ? "active-word" : ""} ${
                    isPastWord ? "completed-word" : ""
                  }`}
                >
                  {/* Word Characters */}
                  {word.split("").map((char, ci) => {
                    const typedChar = typedWord[ci];
                    let statusClass = "untyped";

                    if (typedChar !== undefined) {
                      statusClass = typedChar === char ? "correct" : "incorrect";
                    }

                    const showCaretHere = isCurrentWord && ci === typedWord.length && !buffer;

                    return (
                      <span key={ci} className={`char-span ${statusClass}`}>
                        {showCaretHere && <span className="caret-cursor" />}
                        {char}
                      </span>
                    );
                  })}

                  {/* Buffer / Overflow characters */}
                  {buffer && (
                    <span className="buffer-span">
                      {isCurrentWord && typedWord.length >= word.length && (
                        <span className="caret-cursor buffer-caret" />
                      )}
                      {buffer.split("").map((b, bi) => (
                        <span key={bi} className="char-span extra-char">
                          {b}
                        </span>
                      ))}
                    </span>
                  )}

                  {/* End of word caret when word is typed completely */}
                  {isCurrentWord && typedWord.length >= word.length && !buffer && (
                    <span className="caret-cursor end-caret" />
                  )}

                  <span className="word-spacer">&nbsp;</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Quick Restart Action & Keyboard Shortcut Hint */}
        <div className="restart-controls">
          <button onClick={startTest} className="restart-btn" title="Restart Sprint (Tab + Enter)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
            </svg>
          </button>
          <div className="shortcut-tip">
            <kbd>tab</kbd> + <kbd>enter</kbd> or <kbd>esc</kbd> to restart
          </div>
        </div>
      </main>
    </div>
  );
}

export default TypingTest;