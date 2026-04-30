import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import axios   from "axios";
import url     from "./url/url";

const API = url;

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function logIcon(t) {
  if (t === "success") return "✅";
  if (t === "error")   return "❌";
  if (t === "warn")    return "⚠️";
  return "ℹ️";
}

const FIX_OPTIONS = [
  { key: "link",        label: "🔗 Download Links",  desc: "APKPure (Mobile) / FitGirl (PC)"   },
  { key: "image",       label: "🖼 Images",           desc: "Cover + screenshots from IGDB/RAWG" },
  { key: "description", label: "📝 Descriptions",    desc: "Game summary / description text"    },
  { key: "trailer",     label: "🎬 Trailers",         desc: "YouTube official trailer links"     },
];

export default function AutoUpdate() {
  const [targets,   setTargets]   = useState(["link", "image", "description", "trailer"]);
  const [platform,  setPlatform]  = useState("both");
  const [status,    setStatus]    = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [preloading,setPreloading]= useState(false);
  const [message,   setMessage]   = useState("");
  const [flash,     setFlash]     = useState({});

  const pollRef    = useRef(null);
  const logRef     = useRef(null);
  const autoScroll = useRef(true);
  const prevStats  = useRef({});

  // ── Poll ──────────────────────────────────────────────────────
  const fetchStatus = () => {
    axios.get(API + "/autoupdate/status")
      .then(res => {
        setStatus(prev => {
          const next = res.data;
          // Flash changed stat counters
          const newFlash = {};
          ["linksFixed","imagesFixed","descFixed"].forEach(k => {
            if (prev?.stats?.[k] !== next.stats?.[k]) newFlash[k] = true;
          });
          if (Object.keys(newFlash).length) {
            setFlash(newFlash);
            setTimeout(() => setFlash({}), 600);
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

  // Auto-scroll log
  useEffect(() => {
    if (autoScroll.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  // ── Preview ───────────────────────────────────────────────────
  const fetchPreview = async () => {
    setPreloading(true);
    try {
      const res = await axios.post(API + "/autoupdate/preview", { targets, platform });
      setPreview(res.data);
    } catch (_) {}
    setPreloading(false);
  };

  // Re-fetch preview when options change (only when not running)
  useEffect(() => {
    if (!status?.isRunning) fetchPreview();
  }, [targets, platform]);

  // ── Start ─────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!targets.length) return setMessage("Select at least one fix target.");
    setLoading(true);
    try {
      const res = await axios.post(API + "/autoupdate/start", { targets, platform });
      setMessage(res.data.message);
      setTimeout(fetchStatus, 600);
    } catch (err) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  // ── Stop ──────────────────────────────────────────────────────
  const handleStop = async () => {
    setLoading(true);
    try {
      await axios.post(API + "/autoupdate/stop");
      setMessage("Stop requested — finishing current game…");
      setTimeout(fetchStatus, 1200);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
    setLoading(false);
  };

  const toggleTarget = (key) =>
    setTargets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const isRunning  = status?.isRunning;
  const s          = status?.stats || {};
  const log        = status?.log   || [];
  const cur        = status?.currentGame;
  const hasGame    = cur?.name;
  const pct        = s.total ? Math.round((s.done / s.total) * 100) : 0;

  return (
    <>
      <Sidebar />
      <div className="games-main">
        <div className="games-container">

          {/* Header */}
          <h2>🔄 Auto Update Games</h2>
          <p style={{ color: "#aaa", marginBottom: 24 }}>
            Automatically scans your database for incomplete games and fills in missing
            download links, images, descriptions, and trailers from IGDB, RAWG, APKPure, FitGirl &amp; YouTube.
          </p>

          {/* Two-column layout */}
          <div className="au-layout">

            {/* ── Left: Config ─────────────────────────────────── */}
            <div className="au-config-panel">

              {/* What to fix */}
              <div className="au-section">
                <div className="au-section-title">What to fix</div>
                <div className="au-targets">
                  {FIX_OPTIONS.map(opt => (
                    <label
                      key={opt.key}
                      className={`au-target-card ${targets.includes(opt.key) ? "selected" : ""} ${isRunning ? "disabled" : ""}`}
                      onClick={() => !isRunning && toggleTarget(opt.key)}
                    >
                      <input
                        type="checkbox"
                        checked={targets.includes(opt.key)}
                        readOnly
                        style={{ display: "none" }}
                      />
                      <div className="au-target-check">{targets.includes(opt.key) ? "☑" : "☐"}</div>
                      <div className="au-target-text">
                        <span className="au-target-label">{opt.label}</span>
                        <span className="au-target-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div className="au-section">
                <div className="au-section-title">Platform</div>
                <div className="platform-selector">
                  {[
                    { val: "both",   label: "🌐 Both" },
                    { val: "PC",     label: "💻 PC" },
                    { val: "Mobile", label: "📱 Mobile" },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      className={`platform-tab-btn ${platform === opt.val ? "active" : ""}`}
                      onClick={() => !isRunning && setPlatform(opt.val)}
                      disabled={isRunning}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Preview counts */}
              <div className="au-section">
                <div className="au-section-title">
                  Affected Games
                  {preloading && <span className="au-loading-dot"> ⏳</span>}
                </div>
                {preview ? (
                  <div className="au-preview-grid">
                    <div className="au-preview-item au-preview-total">
                      <span className="au-preview-num">{preview.count}</span>
                      <span className="au-preview-lbl">will be processed</span>
                    </div>
                    <div className="au-preview-item">
                      <span className="au-preview-num">{preview.detail.noLink}</span>
                      <span className="au-preview-lbl">missing links</span>
                    </div>
                    <div className="au-preview-item">
                      <span className="au-preview-num">{preview.detail.noImage}</span>
                      <span className="au-preview-lbl">missing images</span>
                    </div>
                    <div className="au-preview-item">
                      <span className="au-preview-num">{preview.detail.noDesc}</span>
                      <span className="au-preview-lbl">missing descriptions</span>
                    </div>
                    <div className="au-preview-item">
                      <span className="au-preview-num">{preview.detail.noTrailer}</span>
                      <span className="au-preview-lbl">missing trailers</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "#555", fontSize: 13 }}>Loading preview…</p>
                )}
              </div>

              {/* Actions */}
              <div className="import-actions">
                {!isRunning ? (
                  <button className="import-start-btn" onClick={handleStart} disabled={loading || !targets.length}>
                    {loading ? "Starting…" : "▶ Start Auto Update"}
                  </button>
                ) : (
                  <button className="import-stop-btn" onClick={handleStop} disabled={loading}>
                    {loading ? "Stopping…" : "⏹ Stop"}
                  </button>
                )}
              </div>

              {message && (
                <div className="import-message" style={{ marginTop: 12 }}>
                  {message}
                  <button onClick={() => setMessage("")} style={{ marginLeft: 10, background: "none", border: "none", color: "#aaa", cursor: "pointer" }}>✕</button>
                </div>
              )}
            </div>

            {/* ── Right: Live Progress ─────────────────────────── */}
            <div className="au-progress-panel">

              {/* Overall progress bar */}
              <div className="au-section">
                <div className="au-section-title" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Progress</span>
                  <span style={{ color: "#6c63ff" }}>{s.done ?? 0} / {s.total ?? 0}</span>
                </div>
                <div className="au-progress-bar-track">
                  <div
                    className="au-progress-bar-fill"
                    style={{ width: `${pct}%`, transition: "width 0.5s ease" }}
                  ></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginTop: 4 }}>
                  <span>{pct}% complete</span>
                  <span style={{ color: "#f87171" }}>{s.errors ?? 0} errors</span>
                </div>
              </div>

              {/* Fix counters */}
              <div className="au-fix-counters">
                <div className={`au-fix-chip ${flash.linksFixed ? "stat-flash" : ""}`}>
                  <span className="au-fix-num">{s.linksFixed ?? 0}</span>
                  <span className="au-fix-lbl">Links Fixed</span>
                </div>
                <div className={`au-fix-chip ${flash.imagesFixed ? "stat-flash" : ""}`}>
                  <span className="au-fix-num">{s.imagesFixed ?? 0}</span>
                  <span className="au-fix-lbl">Images Fixed</span>
                </div>
                <div className={`au-fix-chip ${flash.descFixed ? "stat-flash" : ""}`}>
                  <span className="au-fix-num">{s.descFixed ?? 0}</span>
                  <span className="au-fix-lbl">Descs Fixed</span>
                </div>
              </div>

              {/* Current game */}
              {isRunning && (
                <div className="import-current-game" style={{ marginBottom: 12 }}>
                  {hasGame ? (
                    <>
                      <div className="cg-platform-badge" data-platform={cur.platform}>
                        {cur.platform === "PC" ? "💻 PC" : "📱 Mobile"}
                      </div>
                      <div className="cg-info">
                        <span className="cg-title">{cur.name}</span>
                        <span className="cg-step">
                          <span className="cg-spinner"></span>
                          {cur.step}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="cg-info">
                      <span className="cg-step"><span className="cg-spinner"></span>Processing…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Live Log */}
              <div className="import-log-section" style={{ marginTop: 0 }}>
                <div className="import-log-header">
                  <span>📋 Live Log</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={{ color: "#aaa", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked onChange={e => { autoScroll.current = e.target.checked; }} style={{ accentColor: "#6c63ff" }} />
                      Auto-scroll
                    </label>
                    <span style={{ color: "#555", fontSize: 12 }}>{log.length}/80</span>
                  </div>
                </div>
                <div
                  className="import-log-box"
                  ref={logRef}
                  style={{ height: 340 }}
                  onScroll={e => {
                    const el = e.target;
                    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                  }}
                >
                  {log.length === 0 ? (
                    <div className="log-empty">
                      {isRunning ? "⏳ Waiting for first log entry…" : "Configure options and click Start Auto Update."}
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

            </div>{/* /au-progress-panel */}
          </div>{/* /au-layout */}

          {/* Info box */}
          <div className="import-info-box" style={{ marginTop: 24 }}>
            <h4>ℹ️ How Auto Update works</h4>
            <ul>
              <li>Queries the database for games with empty/missing fields based on your selection</li>
              <li>For <strong>Mobile games</strong>: fetches images &amp; descriptions from IGDB, download links from APKPure</li>
              <li>For <strong>PC games</strong>: fetches images &amp; descriptions from RAWG, torrent/magnet links from FitGirl</li>
              <li>Trailers are searched on YouTube for both platforms</li>
              <li>Only missing fields are updated — existing data is never overwritten</li>
              <li>A 1.5 s delay between games prevents API rate-limiting</li>
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}
