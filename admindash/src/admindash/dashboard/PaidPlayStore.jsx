// ══════════════════════════════════════════════════════════════════
//  PaidPlayStore.jsx
//  Admin page — import PAID Android games from Play Store top-paid
//  chart. Uses only CSS classes already defined in Style.css.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import axios   from "axios";
import url     from "./url/url";

const API = url;

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function logIcon(type) {
  if (type === "success") return "✅";
  if (type === "error")   return "❌";
  if (type === "warn")    return "⚠️";
  return "ℹ️";
}

function StatBox({ label, value, flash }) {
  return (
    <div className={`stat-box ${flash ? "stat-flash" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function PaidPlayStore() {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [flash,   setFlash]   = useState(false);

  const pollRef    = useRef(null);
  const logRef     = useRef(null);
  const autoScroll = useRef(true);

  const fetchStatus = () => {
    axios.get(API + "/import/playstore-paid/status")
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
    setLoading(true); setMessage("");
    try {
      const res = await axios.post(API + "/import/playstore-paid/start");
      setMessage(res.data.message || "Paid Play Store import started");
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await axios.post(API + "/import/playstore-paid/stop");
      setMessage(res.data.message || "Stop requested");
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset Paid Play Store import progress to page 1?")) return;
    setLoading(true); setMessage("");
    try {
      const res = await axios.post(API + "/import/playstore-paid/reset");
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

          {/* ── Banner ─────────────────────────────────────────── */}
          <div className="fitgirl-banner" style={{ borderLeft: "4px solid #f5a623" }}>
            <div className="fitgirl-banner-icon">💰</div>
            <div>
              <div className="fitgirl-banner-title">Paid Play Store Auto-Import</div>
              <div className="fitgirl-banner-sub">
                Scrapes the <strong>Google Play Store top-paid chart</strong> page by page.
                Only saves games with a non-zero price — free games are automatically skipped.
                Download links come from <strong>APKPure XAPK</strong>.
                YouTube trailers are fetched and stored automatically.
              </div>
            </div>
          </div>

          {/* ── Status card ────────────────────────────────────── */}
          <div className="import-status-card">
            <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
              <span className="status-dot"></span>
              {isRunning ? "🟢 Running" : "🔴 Stopped"}
            </div>

            {status && (
              <div className="import-stats">
                <StatBox label="Paid Games Imported" value={status.totalImported ?? 0} flash={flash} />
                <StatBox label="Current Page"        value={status.lastPage ?? 1} />
                <StatBox label="Source"              value="Paid Play Store" />
                <StatBox label="Last Update"         value={<span style={{ fontSize: 12 }}>{fmtTime(status.updatedAt)}</span>} />
              </div>
            )}
          </div>

          {/* ── Current game ───────────────────────────────────── */}
          {isRunning && (
            <div className="import-current-game">
              {hasGame ? (
                <>
                  <div className="cg-platform-badge" style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", borderColor: "rgba(245,166,35,0.3)" }}>
                    💰 Paid
                  </div>
                  <div className="cg-info">
                    <span className="cg-title">{cur.name}</span>
                    <span className="cg-step"><span className="cg-spinner"></span>{cur.step}…</span>
                  </div>
                </>
              ) : (
                <div className="cg-info">
                  <span className="cg-step"><span className="cg-spinner"></span>Scraping next paid chart page…</span>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ────────────────────────────────────────── */}
          <div className="import-actions">
            {!isRunning ? (
              <button
                className="import-start-btn"
                style={{ background: "#f5a623", color: "#000" }}
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? "Starting…" : "💰 Start Paid Import"}
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

          {/* ── Message ────────────────────────────────────────── */}
          {message && (
            <div className="import-message">
              {message}
              <button
                onClick={() => setMessage("")}
                style={{ marginLeft: 12, background: "none", border: "none", color: "#aaa", cursor: "pointer" }}
              >✕</button>
            </div>
          )}

          {/* ── Live log ───────────────────────────────────────── */}
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

            <div className="import-log-box" ref={logRef}>
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

          {/* ── Info box ───────────────────────────────────────── */}
          <div className="import-info-box fitgirl-info-box">
            <h4>💰 How Paid Play Store Import works</h4>
            <ul>
              <li>Loads the <strong>Play Store top-paid games chart</strong> 24 games at a time</li>
              <li>Checks each game's price — <strong>free games are automatically skipped</strong></li>
              <li>Price is stored in the <code>price</code> field; <code>isPaid</code> is set to <code>true</code></li>
              <li>📥 APKPure XAPK download links built automatically for every game</li>
              <li>🎬 YouTube trailers fetched and stored in the <code>video</code> field</li>
              <li>Saved with <code>importSource: "playstore_paid"</code> — won't conflict with free imports</li>
              <li>Click <strong>Stop</strong> any time — <strong>Start</strong> again to resume from where it left off</li>
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}
