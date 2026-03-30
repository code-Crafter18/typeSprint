import React from 'react';
import './settingBar.css';

export function SettingsBar({
  punctuation,
  numbers,
  testMode,
  testDuration,
  onPunctuation,
  onNumbers,
  onTestMode,
  onDuration,
}) {
  const isTimeMode = testMode === 'time';

  return (
    <div className="settings-bar">
      <div className="setting-group">
        <button
          className={`setting-button ${punctuation ? 'active' : ''} ${isTimeMode ? 'disabled' : ''}`}
          onClick={onPunctuation}
          disabled={isTimeMode}
        >
          @ punctuation
        </button>
        <button
          className={`setting-button ${numbers ? 'active' : ''} ${isTimeMode ? 'disabled' : ''}`}
          onClick={onNumbers}
          disabled={isTimeMode}
        >
          # numbers
        </button>
      </div>

      <div className="setting-group">
        <button
          className={`setting-button ${testMode === 'time' ? 'active' : ''}`}
          onClick={() => onTestMode('time')}
        >
          time
        </button>
        <button
          className={`setting-button ${testMode === 'words' ? 'active' : ''}`}
          title="Practice Mode"
          onClick={() => onTestMode('words')}
        >
          words
        </button>
      </div>

      {testMode === 'time' && (
        <div className="setting-group">
          <button
            className={`setting-button ${testDuration === 15 ? 'active' : ''}`}
            onClick={() => onDuration(15)}
          >
            15
          </button>
          <button
            className={`setting-button ${testDuration === 30 ? 'active' : ''}`}
            onClick={() => onDuration(30)}
          >
            30
          </button>
          <button
            className={`setting-button ${testDuration === 45 ? 'active' : ''}`}
            onClick={() => onDuration(45)}
          >
            45
          </button>
          <button
            className={`setting-button ${testDuration === 60 ? 'active' : ''}`}
            onClick={() => onDuration(60)}
          >
            60
          </button>
        </div>
      )}
    </div>
  );
}