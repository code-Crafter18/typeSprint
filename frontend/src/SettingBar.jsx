import React from "react";
import "./settingBar.css";
import { CODE_LANGUAGES } from "./utils/codeTyping.mjs";

export function SettingsBar({
  disabled,
  punctuation,
  numbers,
  soundEnabled,
  testMode,
  testDuration,
  wordCount,
  codeLanguage,
  onCodeLanguage,
  onPunctuation,
  onNumbers,
  onSoundToggle,
  onTestMode,
  onDuration,
  onWordCount,
}) {
  return (
    <div className="settings-bar-container">
      <div className="settings-pill-group">
        {/* Modifiers */}
        <div className="setting-subgroup">
          <button
            className={`setting-btn ${punctuation ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={punctuation}
            onClick={onPunctuation}
            title="Toggle Punctuation"
          >
            @ punctuation
          </button>
          <button
            className={`setting-btn ${numbers ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={numbers}
            onClick={onNumbers}
            title="Toggle Numbers"
          >
            # numbers
          </button>
          <button
            className={`setting-btn sound-btn ${soundEnabled ? "Sound on" : "Sound off"}`}
            type="button"
            disabled={disabled}
            aria-pressed={soundEnabled}
            onClick={onSoundToggle}
            title="Toggle Mechanical Key Clicks"
          >
            {soundEnabled ? "🔊 sound on" : "🔇 sound off"}
          </button>
        </div>

        <div className="setting-divider" />

        {/* Primary Modes */}
        <div className="setting-subgroup">
          <button
            className={`setting-btn ${testMode === "time" ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={testMode === "time"}
            onClick={() => onTestMode("time")}
          >
            time
          </button>
          <button
            className={`setting-btn ${testMode === "words" ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={testMode === "words"}
            onClick={() => onTestMode("words")}
          >
            words
          </button>
          <button
            className={`setting-btn ${testMode === "quote" ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={testMode === "quote"}
            onClick={() => onTestMode("quote")}
          >
            quote
          </button>
          <button
            className={`setting-btn ${testMode === "code" ? "active" : ""}`}
            type="button"
            disabled={disabled}
            aria-pressed={testMode === "code"}
            onClick={() => onTestMode("code")}
          >
            code
          </button>
        </div>

        <div className="setting-divider" />

        {/* Dynamic sub-options depending on mode */}
        {testMode === "time" && (
          <div className="setting-subgroup">
            {[15, 30, 60, 120].map((sec) => (
              <button
                key={sec}
                className={`setting-btn ${testDuration === sec ? "active" : ""}`}
                type="button"
                disabled={disabled}
                aria-pressed={testDuration === sec}
                onClick={() => onDuration(sec)}
              >
                {sec}
              </button>
            ))}
          </div>
        )}

        {testMode === "words" && (
          <div className="setting-subgroup">
            {[10, 25, 50, 100].map((cnt) => (
              <button
                key={cnt}
                className={`setting-btn ${wordCount === cnt ? "active" : ""}`}
                type="button"
                disabled={disabled}
                aria-pressed={wordCount === cnt}
                onClick={() => onWordCount(cnt)}
              >
                {cnt}
              </button>
            ))}
          </div>
        )}

        {testMode === "quote" && (
          <div className="setting-subgroup">
            <span className="quote-mode-label">curated wisdom</span>
          </div>
        )}

        {testMode === "code" && (
          <div className="setting-subgroup">
            <select className="code-language-select" aria-label="Code language" value={codeLanguage}
              onChange={(event) => onCodeLanguage(event.target.value)} disabled={disabled}>
              {Object.entries(CODE_LANGUAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsBar;