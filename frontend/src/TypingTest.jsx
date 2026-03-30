import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./typingTest.css";
import resetButtonImage from "./assets/resetImage.png";
import { SettingsBar } from "./SettingBar.jsx";

export function TypingTest() {
  const [sentence, setSentence] = useState("Loading sentence...");
  const [userInput, setUserInput] = useState("");
  const [testActive, setTestActive] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [extraCharsMap, setExtraCharsMap] = useState({});
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const navigate = useNavigate();

  const [wpmData, setWpmData] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const intervalRef = useRef(null);

  const [punctuation, setPunctuation] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [testMode, setTestMode] = useState("words");
  const [testDuration, setTestDuration] = useState(15);
  const [timeLeft, setTimeLeft] = useState(testDuration);

  const words = sentence.split(" ");

  useEffect(() => {
    startTest();
  }, [punctuation, numbers, testMode, testDuration]);

  useEffect(() => {
    if (testActive && startTime) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.max(
          1,
          Math.round((now - startTime) / 1000)
        );

        if (testMode === "time") {
          const newTimeLeft = testDuration - elapsed;
          setTimeLeft(newTimeLeft < 0 ? 0 : newTimeLeft);
        }
        
        setUserInput(currentInput => {
          const wordsTyped = (currentInput.length / 5); 
          const wpm = Math.round((wordsTyped / elapsed) * 60);

          setWpmData(prevData => {
            const lastEntry = prevData[prevData.length - 1];
            if (lastEntry && lastEntry.time === elapsed) {
              return prevData
                .slice(0, -1)
                .concat({ time: elapsed, wpm: wpm });
            }
            return [...prevData, { time: elapsed, wpm: wpm }];
          });
          
          return currentInput; 
        });

      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [testActive, testMode, testDuration, startTime]);

  useEffect(() => {
    if (testMode === 'time' && timeLeft <= 0 && testActive) {
      setTestActive(false);
      clearInterval(intervalRef.current);
      
      calculateAndSaveResults(
        userInput,
        errorCount,
        wpmData,
        errorData,
        testDuration
      );
    }
  }, [timeLeft, testMode, testActive, errorCount, wpmData, errorData, testDuration, userInput]);


  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!testActive || (testMode === "time" && timeLeft <= 0)) return;

      const currentWord = words[currentWordIndex] || "";
      const currentInput = userInput.split(" ")[currentWordIndex] || "";
      const correctChar = currentWord[currentInput.length] || null;

      if (e.key === "Backspace") {
        const buffer = extraCharsMap[currentWordIndex] || "";
        
        if (buffer.length > 0) {
          setExtraCharsMap((prev) => ({
            ...prev,
            [currentWordIndex]: buffer.slice(0, -1),
          }));
          setErrorCount((prev) => Math.max(0, prev - 1));
          setErrorData((prev) => prev.slice(0, -1));
        } else if (currentInput.length > 0) {
          const charIndexToDelete = currentInput.length - 1;
          const charToDelete = currentInput[charIndexToDelete];
          const charCorrect = currentWord[charIndexToDelete];

          if (charToDelete !== charCorrect) {
            setErrorCount((prev) => Math.max(0, prev - 1));
            setErrorData((prev) => prev.slice(0, -1));
          }

          const allWords = userInput.split(" ");
          allWords[currentWordIndex] = allWords[currentWordIndex].slice(0, -1);
          setUserInput(allWords.join(" "));
        }
        e.preventDefault();
        return;
      }

      if (e.key.length > 1 || e.ctrlKey || e.altKey) return;

      const isLastWord = currentWordIndex === words.length - 1;

      if (!startTime) {
        setStartTime(new Date());
        if (testMode === "time") {
          setTimeLeft(testDuration);
        }
      }

      const now = new Date();
      const elapsed = Math.max(
        1,
        Math.round((now - (startTime || now)) / 1000)
      );

      if (
        !isLastWord &&
        currentInput.length >= currentWord.length &&
        e.key !== " "
      ) {
        setExtraCharsMap((prev) => {
          const current = prev[currentWordIndex] || "";
          if (current.length >= 5) return prev;
          setErrorCount((p) => p + 1);
          setErrorData((prevErr) => [...prevErr, { time: elapsed }]);
          return { ...prev, [currentWordIndex]: current + e.key };
        });
        e.preventDefault();
        return;
      }

      if (e.key === " ") {
        if (currentInput.length === 0) {
          e.preventDefault();
          return;
        }
        if (currentWordIndex < words.length - 1) {
          if (currentInput.length < currentWord.length) {
            const skippedErrors = currentWord.length - currentInput.length;
            setErrorCount((p) => p + skippedErrors);
            const errorEvents = Array(skippedErrors).fill({ time: elapsed });
            setErrorData((prevErr) => [...prevErr, ...errorEvents]);
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
        }
        e.preventDefault();
        return;
      }

      if (correctChar && e.key !== correctChar) {
        setErrorCount((p) => p + 1);
        setErrorData((prevErr) => [...prevErr, { time: elapsed }]);
      }

      const newTypedWord = (currentInput || "") + e.key;
      const allWords = userInput.split(" ");
      allWords[currentWordIndex] = newTypedWord;
      const newUserInput = allWords.join(" ");
      setUserInput(newUserInput);

      if (
        testMode === "words" &&
        isLastWord &&
        newTypedWord.length === currentWord.length
      ) {
        setTestActive(false);
        clearInterval(intervalRef.current);

        const endTime = new Date();
        const timeElapsed = (endTime - startTime) / 1000 || 1;

        setErrorData((currentErrorData) => {
          setWpmData((currentWpmData) => {
            calculateAndSaveResults(
              newUserInput,
              errorCount,
              currentWpmData,
              currentErrorData,
              timeElapsed
            );
            return currentWpmData;
          });
          return currentErrorData;
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    testActive,
    userInput,
    currentWordIndex,
    extraCharsMap,
    words,
    testMode,
    timeLeft,
    errorCount,
    testDuration,
    startTime,
  ]);

  const startTest = () => {
    setTestActive(true);
    setUserInput("");
    setErrorCount(0);
    setExtraCharsMap({});
    setCurrentWordIndex(0);
    setStartTime(null);
    clearInterval(intervalRef.current);
    setWpmData([]);
    setErrorData([]);
    setTimeLeft(testDuration);

    const params = new URLSearchParams({ punctuation, numbers, testMode });

    fetch(`http://127.0.0.1:5000/api/text?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.text && data.text.length > 0) setSentence(data.text);
        else setSentence("Server sent an empty sentence.");
      })
      .catch(() => setSentence("Error: Could not connect to server."));
  };

  const restartTest = () => startTest();

  const handleTestMode = (mode) => {
    setTestMode(mode);
  };

  const handleDuration = (duration) => {
    setTestDuration(duration);
  };

  const calculateAndSaveResults = async (
    finalUserInput,
    finalErrorCount,
    wpmData,
    errorData,
    timeElapsed
  ) => {
    const response = await fetch("http://127.0.0.1:5000/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finalUserInput,
        timeElapsed,
        finalErrorCount,
        wpmData,
        errorData,
      }),
    });

    const results = await response.json();
    if (response.ok) navigate("/results", { state: results });
    else
      navigate("/results", {
        state: { wpm: 0, accuracy: 0, errors: finalErrorCount },
      });
  };

  return (
    <div className="container">
      {testActive && (
        <div className="test-area">
          <h1>TypeSprint</h1>

          <SettingsBar
            punctuation={punctuation}
            numbers={numbers}
            testMode={testMode}
            testDuration={testDuration}
            onPunctuation={() => setPunctuation((p) => !p)}
            onNumbers={() => setNumbers((p) => !p)}
            onTestMode={handleTestMode}
            onDuration={handleDuration}
          />

          {testMode === "time" && (
            <div className="timer-display">{timeLeft}</div>
          )}

          <div className="sentence-display">
            {words.map((word, wi) => {
              const typedWord = (userInput.split(" ")[wi] || "").split("");
              const buffer = extraCharsMap[wi] || "";
              const isCurrentWord = wi === currentWordIndex;

              return (
                <React.Fragment key={wi}>
                  <span
                    className={`word-block ${buffer ? "has-buffer" : ""}`}
                    style={buffer ? { "--buffer-width": `${buffer.length}ch` } : {}}
                  >
                    <span className="word-content">
                      {word.split("").map((char, ci) => {
                        const typedChar = typedWord[ci];
                        let charClass = "";
                        if (typedChar) {
                          charClass =
                            typedChar === char ? "correct" : "incorrect";
                        } else if (
                          isCurrentWord &&
                          ci === typedWord.length &&
                          !buffer
                        ) {
                          charClass = "current";
                        }
                        return (
                          <span key={ci} className={charClass}>
                            {char}
                          </span>
                        );
                      })}
                    </span>

                    {isCurrentWord &&
                      typedWord.length >= word.length &&
                      buffer && (
                        <span className="buffer-group">
                          <span className="current">&nbsp;</span>
                          {buffer.split("").map((b, bi) => (
                            <span key={`buf-${bi}`} className="incorrect">
                              {b}
                            </span>
                          ))}
                        </span>
                      )}

                    {!isCurrentWord && buffer && (
                      <span className="buffer-after">
                        {buffer.split("").map((b, bi) => (
                          <span key={`buf-${bi}`} className="incorrect">
                            {b}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>

                  {wi < words.length - 1 && <span>&nbsp;</span>}
                </React.Fragment>
              );
            })}
          </div>

          <button onClick={restartTest} className="restart-button-image">
            <img
              src={resetButtonImage}
              className="Restart_image"
              alt="Restart Test"
            />
          </button>
        </div>
      )}
    </div>
  );
}

export default TypingTest;