import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import axios   from "axios";
import url     from "./url/url";

const API = url;

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// function logColor(type) {
//   if (type === "success") return "#4ade80";
//   if (type === "error")   return "#f87171";
//   if (type === "warn")    return "#fbbf24";
//   return "#94a3b8";
// }

function logIcon(type) {
  if (type === "success") return "✅";
  if (type === "error")   return "❌";
  if (type === "warn")    return "⚠️";
  return "ℹ️";
}

export default function ImportGames() {
  const [status,   setStatus]   = useState(null);
  const [platform, setPlatform] = useState("both");
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState("");
  const [flash,    setFlash]    = useState(false);

  const pollRef    = useRef(null);
  const logRef     = useRef(null);
  const autoScroll = useRef(true);

  const fetchStatus = () => {
    axios.get(API + "/import/status")
      .then(res => {
        setStatus(prev => {
          const next = res.data;
          if (prev && next.totalImported > (prev.totalImported || 0)) {
            setFlash(true);
            setTimeout(() => setFlash(false), 600);
          }
          return next;
        });
      })
      .catch(() => {});
  };

  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    if (status?.isRunning) {
      pollRef.current = setInterval(fetchStatus, 2000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [status?.isRunning]);

  useEffect(() => {
    if (autoScroll.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status?.log]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/start", { platform });
      setMessage(res.data.message || "Import started");
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/stop");
      setMessage(res.data.message || "Stop requested");
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset import progress to page 1?")) return;
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/reset");
      setMessage(res.data.message);
      fetchStatus();
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const isRunning = status?.isRunning;
  const log       = status?.log || [];
  const cur       = status?.currentGame;
  const hasGame   = cur?.name;

  return (
    <>
      <Sidebar />
      <div className="games-main">
        <div className="games-container">

          <h2>📥 Import Games</h2>
          <p style={{ color: "#aaa", marginBottom: 24 }}>
            Continuously imports games from <strong>RAWG</strong> (PC) and <strong>IGDB</strong> (Mobile),
            with APKPure download links and FitGirl torrent links automatically fetched.
          </p>

          {/* Status + Stats */}
          <div className="import-status-card">
            <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
              <span className="status-dot"></span>
              {isRunning ? "🟢 Running" : "🔴 Stopped"}
            </div>

            {status && (
              <div className="import-stats">
                <div className={`stat-box ${flash ? "stat-flash" : ""}`}>
                  <span className="stat-label">Games Imported</span>
                  <span className="stat-value">{status.totalImported ?? 0}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Current Page</span>
                  <span className="stat-value">{status.lastPage ?? 1}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Platform</span>
                  <span className="stat-value">{status.platform || "—"}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Last Update</span>
                  <span className="stat-value" style={{ fontSize: 12 }}>
                    {fmtTime(status.updatedAt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Current Game Being Processed */}
          {isRunning && (
            <div className="import-current-game">
              {hasGame ? (
                <>
                  <div className="cg-platform-badge" data-platform={cur.platform}>
                    {cur.platform === "PC" ? "💻 PC" : "📱 Mobile"}
                  </div>
                  <div className="cg-info">
                    <span className="cg-title">{cur.name}</span>
                    <span className="cg-step">
                      <span className="cg-spinner"></span>
                      {cur.step}…
                    </span>
                  </div>
                </>
              ) : (
                <div className="cg-info">
                  <span className="cg-step">
                    <span className="cg-spinner"></span>
                    Fetching next batch…
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Platform Selector */}
          {!isRunning && (
            <div className="import-options">
              <label className="import-label">Platform to import:</label>
              <div className="platform-selector">
                {[
                  { val: "both",   label: "🌐 Both (PC + Mobile)" },
                  { val: "PC",     label: "💻 PC Only (RAWG)" },
                  { val: "Mobile", label: "📱 Mobile Only (IGDB)" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    className={`platform-tab-btn ${platform === opt.val ? "active" : ""}`}
                    onClick={() => setPlatform(opt.val)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="import-actions">
            {!isRunning ? (
              <button className="import-start-btn" onClick={handleStart} disabled={loading}>
                {loading ? "Starting…" : "▶ Start Import"}
              </button>
            ) : (
              <button className="import-stop-btn" onClick={handleStop} disabled={loading}>
                {loading ? "Stopping…" : "⏹ Stop Import"}
              </button>
            )}
            {!isRunning && (
              <button className="import-reset-btn" onClick={handleReset} disabled={loading} title="Reset progress to page 1">
                🔄 Reset Progress
              </button>
            )}
          </div>

          {/* Message */}
          {message && (
            <div className="import-message">
              {message}
              <button onClick={() => setMessage("")} style={{ marginLeft: 12, background: "none", border: "none", color: "#aaa", cursor: "pointer" }}>✕</button>
            </div>
          )}

          {/* Live Log */}
          <div className="import-log-section">
            <div className="import-log-header">
              <span>📋 Live Log</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ color: "#aaa", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={e => { autoScroll.current = e.target.checked; }}
                    style={{ accentColor: "#6c63ff" }}
                  />
                  Auto-scroll
                </label>
                <span style={{ color: "#555", fontSize: 12 }}>{log.length} / 60 entries</span>
              </div>
            </div>

            <div
              className="import-log-box"
              ref={logRef}
              onScroll={e => {
                const el = e.target;
                autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
            >
              {log.length === 0 ? (
                <div className="log-empty">
                  {isRunning ? "⏳ Waiting for first log entry…" : "Start import to see live logs here."}
                </div>
              ) : (
                log.map((entry, i) => (
                  <div key={i} className={`log-entry log-${entry.type}`}>
                    <span className="log-ts">{fmtTime(entry.ts)}</span>
                    <span className="log-icon">{logIcon(entry.type)}</span>
                    <span className="log-msg">{entry.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Info */}
          <div className="import-info-box">
            <h4>ℹ️ How it works</h4>
            <ul>
              <li>Fetches PC games from <strong>RAWG API</strong> with HD cover + background images</li>
              <li>Fetches Mobile games from <strong>IGDB API</strong> (Android / iOS platforms)</li>
              <li>📱 Automatically finds <strong>APKPure XAPK one-click download links</strong> for every mobile game</li>
              <li>💻 Automatically finds <strong>FitGirl torrent/magnet links</strong> for every PC game</li>
              <li>Automatically searches YouTube for each game's official trailer</li>
              <li>Skips duplicates (checked by title and external ID)</li>
              <li>Progress is saved to DB — click <strong>Stop</strong> any time and resume later</li>
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}
