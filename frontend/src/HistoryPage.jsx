import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HistoryPage.css";
import { apiRequest } from "./api.js";
import { AccountAction } from "./components/AccountAction.jsx";

export function HistoryPage({ auth }) {
  if (auth.user) return <SignedInHistory auth={auth} />;

  return (
    <main className="history-container">
      <Link to="/" className="action-button primary-btn">Back to typing</Link>
      <section className="empty-state">
        <h1>Sprint history</h1>
        {auth.loading ? <p role="status">Checking your session…</p> : (
          <>
            <p>
              {auth.unavailable ? "Account service is temporarily unavailable."
                : "Sign in to save future sprints and see your history on any device."}
            </p>
            {auth.unavailable
              ? <button type="button" className="account-button" onClick={auth.reload}>Retry</button>
              : <AccountAction auth={auth} returnTo="/history" />}
          </>
        )}
      </section>
    </main>
  );
}

function SignedInHistory({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [mutating, setMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { stats, history = [], trendGraphImage: trendGraph, pagination = { page: 1, totalPages: 0 } } = data || {};

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page, pageSize: 50, mode: filterMode });
    setLoading(true);
    setErrorMessage("");
    apiRequest("/api/history?" + params, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setData(null);
          setErrorMessage(error.message || "Failed to load typing history.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filterMode, page, revision]);

  const refresh = () => setRevision((value) => value + 1);

  const deleteHistory = async (id) => {
    setMutating(true);
    setErrorMessage("");
    try {
      await apiRequest(id ? "/api/history/" + encodeURIComponent(id) : "/api/history", { method: "DELETE" });
      if (!id) setPage(1);
      refresh();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update typing history.");
    } finally {
      setMutating(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear all typing history for your account, including other modes?")) {
      deleteHistory();
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
          <AccountAction auth={auth} />
          <Link to="/" className="action-button primary-btn">
            ← Back to Test
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="loading-state" role="status">Loading typing statistics...</div>
      ) : (
        <main className="history-content">
          {errorMessage && (
            <div className="error-banner" role="alert">
              <span>{errorMessage}</span>
              <button type="button" onClick={refresh}>Retry</button>
            </div>
          )}
          {/* Lifetime Statistics Cards */}
          <p className="history-scope">{filterMode === "all" ? "All sprint modes" : "Showing " + filterMode + " sprints"}</p>
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
              <div className="header-title-group">
                <h3>Recent Sessions</h3>
                <div className="history-filter-pills">
                    {["all", "time", "words", "quote", "code"].map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={`filter-pill ${filterMode === m ? "active" : ""}`}
                        aria-pressed={filterMode === m}
                        disabled={mutating}
                        onClick={() => { setPage(1); setFilterMode(m); }}
                      >
                        {m}
                      </button>
                    ))}
                </div>
              </div>
              {history.length > 0 && (
                <button type="button" disabled={mutating} onClick={handleClearHistory} className="clear-btn">
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="empty-state">
                <p>
                  {!data ? "History is unavailable." : filterMode === "all"
                    ? "No tests recorded yet. Take your first sprint!"
                    : "No tests found in " + filterMode + " mode."}
                </p>
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
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="cell-muted">{pagination.totalTests - (pagination.page - 1) * pagination.pageSize - idx}</td>
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
                        <td className="cell-action">
                          <button
                            className="delete-item-btn"
                            type="button"
                            aria-label="Delete sprint"
                            disabled={mutating}
                            onClick={() => deleteHistory(item.id)}
                            title="Delete this sprint record"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination.totalPages > 1 && (
              <div className="history-pagination">
                <button
                  type="button"
                  disabled={mutating || pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Previous
                </button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  type="button"
                  disabled={mutating || pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
export default HistoryPage;
