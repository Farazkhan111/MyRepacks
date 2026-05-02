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

function logIcon(type) {
  if (type === "success") return "✅";
  if (type === "error")   return "❌";
  if (type === "warn")    return "⚠️";
  return "ℹ️";
}

// ── Source tabs ──────────────────────────────────────────────────
const SOURCES = [
  { id: "rawg_igdb",   label: "🌐 RAWG + IGDB",      desc: "PC games via RAWG, Mobile via IGDB" },
  { id: "fitgirl",     label: "🏴‍☠️ FitGirl Repacks",  desc: "Scrape directly from fitgirl-repacks.site" },
  { id: "playstore",   label: "📱 Play Store",        desc: "Import any Android game by Play Store URL" },
];

// ── Platform sub-tabs (only for rawg_igdb source) ────────────────
const PLATFORMS = [
  { val: "both",   label: "🌐 Both (PC + Mobile)" },
  { val: "PC",     label: "💻 PC Only (RAWG)" },
  { val: "Mobile", label: "📱 Mobile Only (IGDB)" },
];

// ── Reusable stat box ─────────────────────────────────────────────
function StatBox({ label, value, flash }) {
  return (
    <div className={`stat-box ${flash ? "stat-flash" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

// ── Log panel ─────────────────────────────────────────────────────
function LogPanel({ log, isRunning, logRef, onScrollChange }) {
  return (
    <div className="import-log-section">
      <div className="import-log-header">
        <span>📋 Live Log</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ color: "#aaa", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              defaultChecked
              onChange={e => onScrollChange(e.target.checked)}
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
  );
}

// ════════════════════════════════════════════════════════════════
//  RAWG / IGDB PANEL
// ════════════════════════════════════════════════════════════════
function RawgIgdbPanel() {
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
      {/* Status card */}
      <div className="import-status-card">
        <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
          <span className="status-dot"></span>
          {isRunning ? "🟢 Running" : "🔴 Stopped"}
        </div>

        {status && (
          <div className="import-stats">
            <StatBox label="Games Imported" value={status.totalImported ?? 0} flash={flash} />
            <StatBox label="Current Page"   value={status.lastPage ?? 1} />
            <StatBox label="Platform"        value={status.platform || "—"} />
            <StatBox
              label="Last Update"
              value={<span style={{ fontSize: 12 }}>{fmtTime(status.updatedAt)}</span>}
            />
          </div>
        )}
      </div>

      {/* Current game */}
      {isRunning && (
        <div className="import-current-game">
          {hasGame ? (
            <>
              <div className="cg-platform-badge" data-platform={cur.platform}>
                {cur.platform === "PC" ? "💻 PC" : "📱 Mobile"}
              </div>
              <div className="cg-info">
                <span className="cg-title">{cur.name}</span>
                <span className="cg-step"><span className="cg-spinner"></span>{cur.step}…</span>
              </div>
            </>
          ) : (
            <div className="cg-info">
              <span className="cg-step"><span className="cg-spinner"></span>Fetching next batch…</span>
            </div>
          )}
        </div>
      )}

      {/* Platform selector */}
      {!isRunning && (
        <div className="import-options">
          <label className="import-label">Platform to import:</label>
          <div className="platform-selector">
            {PLATFORMS.map(opt => (
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

      {/* Action buttons */}
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

      {/* Log */}
      <LogPanel
        log={log}
        isRunning={isRunning}
        logRef={logRef}
        onScrollChange={v => { autoScroll.current = v; }}
      />

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
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  FITGIRL PANEL
// ════════════════════════════════════════════════════════════════
function FitgirlPanel() {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [flash,   setFlash]   = useState(false);

  const pollRef    = useRef(null);
  const logRef     = useRef(null);
  const autoScroll = useRef(true);

  const fetchStatus = () => {
    axios.get(API + "/import/fitgirl/status")
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
      const res = await axios.post(API + "/import/fitgirl/start");
      setMessage(res.data.message || "FitGirl import started");
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/fitgirl/stop");
      setMessage(res.data.message || "Stop requested");
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset FitGirl import progress to page 1?")) return;
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/fitgirl/reset");
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
      {/* FitGirl banner */}
      <div className="fitgirl-banner">
        <div className="fitgirl-banner-icon">🏴‍☠️</div>
        <div>
          <div className="fitgirl-banner-title">FitGirl Repacks Direct Import</div>
          <div className="fitgirl-banner-sub">
            Scrapes <a href="https://fitgirl-repacks.site" target="_blank" rel="noreferrer">fitgirl-repacks.site</a> page by page —
            extracts game name, genres, description, <strong>high-resolution screenshots</strong>, and magnet/torrent links automatically.
          </div>
        </div>
      </div>

      {/* Status card */}
      <div className="import-status-card">
        <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
          <span className="status-dot"></span>
          {isRunning ? "🟢 Running" : "🔴 Stopped"}
        </div>

        {status && (
          <div className="import-stats">
            <StatBox label="Games Imported" value={status.totalImported ?? 0} flash={flash} />
            <StatBox label="Current Page"   value={status.lastPage ?? 1} />
            <StatBox label="Source"          value="FitGirl" />
            <StatBox
              label="Last Update"
              value={<span style={{ fontSize: 12 }}>{fmtTime(status.updatedAt)}</span>}
            />
          </div>
        )}
      </div>

      {/* Current game being processed */}
      {isRunning && (
        <div className="import-current-game">
          {hasGame ? (
            <>
              <div className="cg-platform-badge" data-platform="PC">💻 PC</div>
              <div className="cg-info">
                <span className="cg-title">{cur.name}</span>
                <span className="cg-step"><span className="cg-spinner"></span>{cur.step}…</span>
              </div>
            </>
          ) : (
            <div className="cg-info">
              <span className="cg-step"><span className="cg-spinner"></span>Scraping next page…</span>
            </div>
          )}
        </div>
      )}

      {/* Image quality badge */}
      {!isRunning && (
        <div className="fg-image-quality-note">
          <span className="fg-quality-badge">🖼️ HD Images</span>
          Images are automatically upgraded to the highest available resolution —
          Imgur full-size, IGDB 1080p, WordPress original — no thumbnails.
        </div>
      )}

      {/* Action buttons */}
      <div className="import-actions">
        {!isRunning ? (
          <button className="import-start-btn fitgirl-start" onClick={handleStart} disabled={loading}>
            {loading ? "Starting…" : "🏴‍☠️ Start FitGirl Import"}
          </button>
        ) : (
          <button className="import-stop-btn" onClick={handleStop} disabled={loading}>
            {loading ? "Stopping…" : "⏹ Stop Import"}
          </button>
        )}
        {!isRunning && (
          <button className="import-reset-btn" onClick={handleReset} disabled={loading} title="Reset FitGirl progress to page 1">
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

      {/* Log */}
      <LogPanel
        log={log}
        isRunning={isRunning}
        logRef={logRef}
        onScrollChange={v => { autoScroll.current = v; }}
      />

      {/* Info */}
      <div className="import-info-box fitgirl-info-box">
        <h4>🏴‍☠️ How FitGirl Import works</h4>
        <ul>
          <li>Scrapes <strong>fitgirl-repacks.site</strong> archive page by page (newest first)</li>
          <li>Extracts: name, genres/tags, company, description, file sizes</li>
          <li>
            🖼️ <strong>High-resolution images</strong> — upgrades all images automatically:
            <ul style={{ marginTop: 6 }}>
              <li>Imgur: strips thumbnail suffix → full-size original</li>
              <li>WordPress: removes resize params → requests 1920px width</li>
              <li>IGDB embeds: upgrades to <code>t_1080p</code></li>
              <li>SteamCDN images preserved as-is (already max res)</li>
            </ul>
          </li>
          <li>🔗 Magnet links scraped directly from each post (priority: magnet → .torrent → host link)</li>
          <li>🎬 YouTube official trailer auto-fetched for each game</li>
          <li>Skips duplicates — safe to run alongside RAWG/IGDB import</li>
          <li>Progress saved to DB — stop and resume any time</li>
        </ul>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  PLAY STORE PANEL  — auto-import loop (same as RAWG / FitGirl)
// ════════════════════════════════════════════════════════════════
function PlayStorePanel() {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [flash,   setFlash]   = useState(false);

  const pollRef    = useRef(null);
  const logRef     = useRef(null);
  const autoScroll = useRef(true);

  const fetchStatus = () => {
    axios.get(API + "/import/playstore/status")
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
      const res = await axios.post(API + "/import/playstore/start");
      setMessage(res.data.message || "Play Store import started");
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/playstore/stop");
      setMessage(res.data.message || "Stop requested");
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset Play Store import progress to page 1?")) return;
    setLoading(true);
    try {
      const res = await axios.post(API + "/import/playstore/reset");
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
      {/* Banner */}
      <div className="fitgirl-banner" style={{ borderLeft: "4px solid #3ddc84" }}>
        <div className="fitgirl-banner-icon">📱</div>
        <div>
          <div className="fitgirl-banner-title">Play Store Auto-Import</div>
          <div className="fitgirl-banner-sub">
            Scrapes <strong>Google Play Store</strong> top-charts page by page —
            fetches game name, description, icon, and screenshots automatically.
            Download links come from <strong>APKPure XAPK</strong> (one-click).
          </div>
        </div>
      </div>

      {/* Status card */}
      <div className="import-status-card">
        <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
          <span className="status-dot"></span>
          {isRunning ? "🟢 Running" : "🔴 Stopped"}
        </div>

        {status && (
          <div className="import-stats">
            <StatBox label="Games Imported" value={status.totalImported ?? 0} flash={flash} />
            <StatBox label="Current Page"   value={status.lastPage ?? 1} />
            <StatBox label="Source"          value="Play Store" />
            <StatBox
              label="Last Update"
              value={<span style={{ fontSize: 12 }}>{fmtTime(status.updatedAt)}</span>}
            />
          </div>
        )}
      </div>

      {/* Current game being processed */}
      {isRunning && (
        <div className="import-current-game">
          {hasGame ? (
            <>
              <div className="cg-platform-badge" data-platform="Mobile">📱 Mobile</div>
              <div className="cg-info">
                <span className="cg-title">{cur.name}</span>
                <span className="cg-step"><span className="cg-spinner"></span>{cur.step}…</span>
              </div>
            </>
          ) : (
            <div className="cg-info">
              <span className="cg-step"><span className="cg-spinner"></span>Scraping next chart page…</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="import-actions">
        {!isRunning ? (
          <button className="import-start-btn fitgirl-start" style={{ background: "#3ddc84", color: "#000" }} onClick={handleStart} disabled={loading}>
            {loading ? "Starting…" : "📱 Start Play Store Import"}
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

      {/* Log */}
      <LogPanel
        log={log}
        isRunning={isRunning}
        logRef={logRef}
        onScrollChange={v => { autoScroll.current = v; }}
      />

      {/* Info */}
      <div className="import-info-box fitgirl-info-box">
        <h4>📱 How Play Store Import works</h4>
        <ul>
          <li>Scrapes <strong>Google Play Store</strong> top-charts page by page (24 games per page)</li>
          <li>Fetches each game's <strong>name, description, icon, and screenshots</strong> from its Play Store page</li>
          <li>📥 Automatically builds <strong>APKPure XAPK one-click download links</strong> for every game</li>
          <li>Platform set to <strong>Mobile</strong> · category auto-mapped from Play Store genre</li>
          <li>Skips duplicates — safe to run alongside the RAWG/IGDB Mobile import</li>
          <li>Click <strong>Stop</strong> any time — click <strong>Start</strong> again to resume from where it left off</li>
        </ul>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function ImportGames() {
  const [activeSource, setActiveSource] = useState("rawg_igdb");

  return (
    <>
      <Sidebar />
      <div className="games-main">
        <div className="games-container">

          <h2>📥 Import Games</h2>
          <p style={{ color: "#aaa", marginBottom: 24 }}>
            Import games from multiple sources. Each source runs independently with its own progress tracking.
          </p>

          {/* Source selector tabs */}
          <div className="import-source-tabs">
            {SOURCES.map(src => (
              <button
                key={src.id}
                className={`import-source-tab ${activeSource === src.id ? "active" : ""}`}
                onClick={() => setActiveSource(src.id)}
              >
                <span className="ist-label">{src.label}</span>
                <span className="ist-desc">{src.desc}</span>
              </button>
            ))}
          </div>

          {/* Panel */}
          {activeSource === "rawg_igdb"  && <RawgIgdbPanel />}
          {activeSource === "fitgirl"    && <FitgirlPanel />}
          {activeSource === "playstore"  && <PlayStorePanel />}

        </div>
      </div>
    </>
  );
}
