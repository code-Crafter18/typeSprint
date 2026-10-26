import React, { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import "./ResultPage.css";
import { InteractiveChart } from "./components/InteractiveChart.jsx";

export function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Retrieve cached results if state is empty upon refresh
  const [results, setResults] = useState(() => {
    if (state && typeof state.wpm !== "undefined") {
      return state;
    }
    const cached = sessionStorage.getItem("lastSprintResults");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return {
      wpm: 0,
      raw_wpm: 0,
      accuracy: 0,
      errors: 0,
      time: 0,
      consistency: 100,
      graph_image: null,
      wpmData: [],
      errorData: [],
      keystrokes: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
    };
  });

  const [activeTab, setActiveTab] = useState("matplotlib"); // default to matplotlib as requested

  // Keyboard shortcut: Space or Enter to restart
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        navigate("/");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const {
    wpm = 0,
    raw_wpm = 0,
    accuracy = 0,
    errors = 0,
    time = 0,
    consistency = 100,
    graph_image = null,
    wpmData = [],
    errorData = [],
    keystrokes = { correct: 0, incorrect: 0, extra: 0, missed: 0 },
  } = results;

  return (
    <div className="results-wrapper">
      <header className="results-header">
        <div className="results-brand">
          <Link to="/" className="brand-link">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#e2b714">
              <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
            </svg>
            <span>TypeSprint</span>
          </Link>
          <span className="results-title-badge">Sprint Results</span>
        </div>

        <div className="results-nav-actions">
          <Link to="/" className="nav-btn primary">
            Take Another Sprint
          </Link>
          <Link to="/history" className="nav-btn secondary">
            History & Trends
          </Link>
        </div>
      </header>

      <main className="results-body">
        {/* Key Performance Indicators Grid */}
        <section className="kpi-grid">
          <div className="kpi-card hero-wpm">
            <span className="kpi-label">WPM</span>
            <span className="kpi-value">{wpm}</span>
            <span className="kpi-sub">Net Speed</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Accuracy</span>
            <span className="kpi-value acc">{accuracy}%</span>
            <span className="kpi-sub">{errors} mistake(s)</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Raw WPM</span>
            <span className="kpi-value">{raw_wpm || wpm}</span>
            <span className="kpi-sub">Gross Speed</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Consistency</span>
            <span className="kpi-value">{consistency}%</span>
            <span className="kpi-sub">Rhythm Score</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Time</span>
            <span className="kpi-value">{time}s</span>
            <span className="kpi-sub">Duration</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Characters</span>
            <span className="kpi-value char-breakdown">
              <span className="c-correct" title="Correct characters">{keystrokes?.correct || 0}</span>
              <span className="c-sep">/</span>
              <span className="c-incorrect" title="Incorrect characters">{keystrokes?.incorrect || errors}</span>
              <span className="c-sep">/</span>
              <span className="c-extra" title="Extra characters">{keystrokes?.extra || 0}</span>
              <span className="c-sep">/</span>
              <span className="c-missed" title="Missed characters">{keystrokes?.missed || 0}</span>
            </span>
            <span className="kpi-sub">cor / inc / ext / mis</span>
          </div>
        </section>

        {/* Visual Analytics Card */}
        <section className="analytics-card">
          <div className="analytics-header">
            <h3>Pacing & Mistake Distribution</h3>
            <div className="chart-tabs">
              {graph_image && (
                <button
                  className={`tab-btn ${activeTab === "matplotlib" ? "active" : ""}`}
                  onClick={() => setActiveTab("matplotlib")}
                >
                  Matplotlib Graph
                </button>
              )}
              <button
                className={`tab-btn ${activeTab === "interactive" ? "active" : ""}`}
                onClick={() => setActiveTab("interactive")}
              >
                Interactive Chart
              </button>
            </div>
          </div>

          <div className="chart-display-container">
            {activeTab === "interactive" ? (
              <InteractiveChart wpmData={wpmData} errorData={errorData} avgWpm={wpm} totalTime={time} />
            ) : (
              <div className="matplotlib-view">
                <img src={graph_image} alt="Matplotlib typing speed breakdown" />
              </div>
            )}
          </div>
        </section>

        {/* Quick Restart Bar */}
        <footer className="results-footer">
          <Link to="/" className="action-pill primary-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
            </svg>
            <span>Restart Sprint (Tab or Enter)</span>
          </Link>
        </footer>
      </main>
    </div>
  );
}

export default ResultPage;