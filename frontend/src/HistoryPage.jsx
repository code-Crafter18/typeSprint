import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HistoryPage.css";

export function HistoryPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [trendGraph, setTrendGraph] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = () => {
    setLoading(true);
    fetch("http://127.0.0.1:5000/api/history")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats || null);
        setHistory(data.history || []);
        setTrendGraph(data.trendGraphImage || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load history", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your typing history?")) {
      fetch("http://127.0.0.1:5000/api/history", { method: "DELETE" })
        .then(() => {
          fetchHistory();
        })
        .catch(console.error);
    }
  };

  return (
    <div className="history-container">
      <header className="history-header">
        <div className="header-brand">
          <Link to="/" className="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#e2b714">
              <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
            </svg>
            <span>TypeSprint</span>
          </Link>
          <span className="badge">Analytics & History</span>
        </div>
        <div className="header-actions">
          <Link to="/" className="action-button primary-btn">
            ← Back to Test
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">Loading typing statistics...</div>
      ) : (
        <main className="history-content">
          {/* Lifetime Statistics Cards */}
          <section className="stats-grid">
            <div className="stat-card highlight">
              <span className="stat-title">Best Speed</span>
              <span className="stat-num">{stats?.bestWpm || 0}</span>
              <span className="stat-sub">WPM</span>
            </div>

            <div className="stat-card">
              <span className="stat-title">Average Speed</span>
              <span className="stat-num">{stats?.avgWpm || 0}</span>
              <span className="stat-sub">WPM</span>
            </div>

            <div className="stat-card">
              <span className="stat-title">Avg Accuracy</span>
              <span className="stat-num">{stats?.avgAccuracy || 0}%</span>
              <span className="stat-sub">Across tests</span>
            </div>

            <div className="stat-card">
              <span className="stat-title">Tests Completed</span>
              <span className="stat-num">{stats?.totalTests || 0}</span>
              <span className="stat-sub">Sessions</span>
            </div>

            <div className="stat-card">
              <span className="stat-title">Time Typed</span>
              <span className="stat-num">
                {stats?.totalTime ? Math.round(stats.totalTime / 60) : 0}m
              </span>
              <span className="stat-sub">{stats?.totalTime || 0}s total</span>
            </div>
          </section>

          {/* Trend Chart generated with Pandas & Matplotlib */}
          {trendGraph && (
            <section className="chart-card">
              <div className="card-header">
                <h3>Progression Trend</h3>
                <span className="card-meta">Pandas Moving Average Analysis</span>
              </div>
              <div className="trend-image-wrapper">
                <img src={trendGraph} alt="Typing speed progress over time" />
              </div>
            </section>
          )}

          {/* Past Sessions Table */}
          <section className="table-card">
            <div className="card-header">
              <h3>Recent Sessions</h3>
              {history.length > 0 && (
                <button onClick={handleClearHistory} className="clear-btn">
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="empty-state">
                <p>No tests recorded yet. Take your first sprint!</p>
                <Link to="/" className="action-button primary-btn">
                  Start Typing
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>WPM</th>
                      <th>Accuracy</th>
                      <th>Errors</th>
                      <th>Time</th>
                      <th>Mode</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="cell-muted">{history.length - idx}</td>
                        <td className="cell-wpm">{item.wpm}</td>
                        <td className="cell-acc">{item.accuracy}%</td>
                        <td className="cell-err">{item.errors}</td>
                        <td className="cell-time">{item.time}s</td>
                        <td className="cell-mode">
                          <span className="mode-tag">{item.mode || "test"}</span>
                        </td>
                        <td className="cell-date">
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Recent"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
export default HistoryPage;
