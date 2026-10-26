import React from "react";
import "./settingBar.css";

export function SettingsBar({
  punctuation,
  numbers,
  soundEnabled,
  testMode,
  testDuration,
  wordCount,
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
            onClick={onPunctuation}
            title="Toggle Punctuation"
          >
            @ punctuation
          </button>
          <button
            className={`setting-btn ${numbers ? "active" : ""}`}
            onClick={onNumbers}
            title="Toggle Numbers"
          >
            # numbers
          </button>
          <button
            className={`setting-btn sound-btn ${soundEnabled ? "active" : ""}`}
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
            onClick={() => onTestMode("time")}
          >
            time
          </button>
          <button
            className={`setting-btn ${testMode === "words" ? "active" : ""}`}
            onClick={() => onTestMode("words")}
          >
            words
          </button>
          <button
            className={`setting-btn ${testMode === "quote" ? "active" : ""}`}
            onClick={() => onTestMode("quote")}
          >
            quote
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
      </div>
    </div>
  );
}

export default SettingsBar;