import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import url from "./url/url";

const API = url;

const MOBILE_HOSTS = [
  "apkpure", "apkcombo", "apkmody", "apkmirror", "happymod",
  "an1.com", "revdl", "androidappsapk", "apkdone", "rexdl",
  "mob.org", "apknite", "apksfull",
];

function detectPlatform(inputUrl) {
  try {
    const host = new URL(inputUrl).hostname.toLowerCase();
    return MOBILE_HOSTS.some(h => host.includes(h)) ? "Mobile" : "PC";
  } catch (_) { return "PC"; }
}

const INFO_MAP = {
  Genres: "🎮 Genres", Tags: "🏷️ Tags", Languages: "🌐 Languages",
  "Original Size": "📦 Original Size", "Repack Size": "📁 Repack Size",
  "HDD Space": "💾 HDD Space", Version: "🔖 Version", Crack: "🔓 Crack",
  Developer: "👨‍💻 Developer", Publisher: "🏢 Publisher",
  "Release Date": "📅 Release Date", Size: "📦 Size",
  "Requires Android": "🤖 Android", Category: "📂 Category",
};

const SOURCE_BADGE = { steam: "🎮 Steam", playstore: "▶ Play Store", ai: "🤖 AI", web: "🌐 Web" };

/** Extract YouTube video ID from any YT URL */
function getYouTubeId(ytUrl) {
  if (!ytUrl) return null;
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const re of patterns) {
    const m = ytUrl.match(re);
    if (m) return m[1];
  }
  return null;
}

function SelectBtn({ url, type, selectedImages, setSelectedImages }) {
  const isSelected = selectedImages[type] === url;
  return (
    <button
      className={`img-select-btn ${isSelected ? "selected" : ""}`}
      onClick={() => setSelectedImages(prev => ({ ...prev, [type]: isSelected ? "" : url }))}
    >
      {isSelected
        ? `✓ Selected as ${type === "cover" ? "Cover" : "Hero"}`
        : `Set as ${type === "cover" ? "Cover" : "Hero"}`}
    </button>
  );
}

export default function GameScraper() {
  const nav = useNavigate();

  const [inputUrl,        setInputUrl]       = useState("");
  const [loading,         setLoading]        = useState(false);
  const [error,           setError]          = useState(null);
  const [game,            setGame]           = useState(null);
  const [tab,             setTab]            = useState("info");
  const [detectedPlat,    setDetectedPlat]   = useState("PC");

  const [imgQuery,        setImgQuery]       = useState("");
  const [imgLoading,      setImgLoading]     = useState(false);
  const [imgResults,      setImgResults]     = useState([]);
  const [selectedImages,  setSelectedImages] = useState({ cover: "", hero: "" });

  const [descQuery,       setDescQuery]      = useState("");
  const [descLoading,     setDescLoading]    = useState(false);
  const [descResults,     setDescResults]    = useState([]);
  const [selectedDesc,    setSelectedDesc]   = useState("");
  const [copied,          setCopied]         = useState(false);

  // ── Trailer state ─────────────────────────────────────────────
  const [trailerQuery,    setTrailerQuery]   = useState("");
  const [trailerLoading,  setTrailerLoading] = useState(false);
  const [trailerUrl,      setTrailerUrl]     = useState("");   // full YT URL
  const [trailerError,    setTrailerError]   = useState("");
  const [manualTrailer,   setManualTrailer]  = useState("");   // manual paste input

  // ── Scrape ───────────────────────────────────────────────────
  async function handleScrape() {
    if (!inputUrl.trim()) return;
    const platform = detectPlatform(inputUrl);
    setDetectedPlat(platform);
    setLoading(true); setError(null); setGame(null);
    setImgResults([]); setSelectedImages({ cover: "", hero: "" });
    setDescResults([]); setSelectedDesc("");
    setTrailerUrl(""); setTrailerError(""); setManualTrailer("");

    try {
      const res  = await fetch(`${API}/scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Scrape failed");

      setGame(json.data);
      setImgQuery(json.data.title || "");
      setDescQuery(json.data.title || "");
      setTrailerQuery(json.data.title || "");
      if (json.data.description)
        setDescResults([{ text: json.data.description, source: json.data.descriptionSource || "web" }]);

      // Auto-fill trailer if scraper returned one
      if (json.data.trailer) setTrailerUrl(json.data.trailer);

      setTab("info");
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  // ── Trailer search ───────────────────────────────────────────
  async function handleTrailerSearch() {
    if (!trailerQuery.trim()) return;
    setTrailerLoading(true); setTrailerError(""); setTrailerUrl("");
    try {
      const res  = await fetch(`${API}/trailersearch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: trailerQuery.trim(), platform: detectedPlat }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Search failed");
      if (json.trailer) {
        setTrailerUrl(json.trailer);
      } else {
        setTrailerError("No trailer found. Try a different search term or paste a URL manually.");
      }
    } catch (e) {
      setTrailerError(e.message);
    } finally {
      setTrailerLoading(false);
    }
  }

  // ── Apply manual trailer URL ─────────────────────────────────
  function applyManualTrailer() {
    const id = getYouTubeId(manualTrailer.trim());
    if (id) {
      setTrailerUrl(`https://www.youtube.com/watch?v=${id}`);
      setManualTrailer("");
      setTrailerError("");
    } else {
      setTrailerError("Invalid YouTube URL. Accepted: youtu.be/xxx, youtube.com/watch?v=xxx, /shorts/xxx");
    }
  }

  // ── Description search ───────────────────────────────────────
  async function handleDescSearch() {
    if (!descQuery.trim()) return;
    setDescLoading(true);
    try {
      const res  = await fetch(`${API}/descsearch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: descQuery.trim(), platform: detectedPlat }),
      });
      const json = await res.json();
      const fresh = json.results || [];
      setDescResults(prev => {
        const existing = prev.filter(r => r.source === "web");
        return [...existing, ...fresh.filter(r => !existing.some(e => e.text === r.text))];
      });
    } catch (_) {}
    finally { setDescLoading(false); }
  }

  // ── Image search ─────────────────────────────────────────────
  async function handleImageSearch() {
    if (!imgQuery.trim()) return;
    setImgLoading(true); setImgResults([]);
    try {
      const res  = await fetch(`${API}/imagesuggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: imgQuery.trim(), platform: detectedPlat }),
      });
      const json = await res.json();
      setImgResults(json.results || []);
    } catch (_) { setImgResults([]); }
    finally { setImgLoading(false); }
  }

  // ── Send to AddGame ──────────────────────────────────────────
  function sendToAddGame() {
    if (!game) return;
    const payload = {
      gname:     game.title || "",
      gdes:      selectedDesc || game.description || "",
      gimage:    selectedImages.cover  || game.cover  || "",
      gfimage:   selectedImages.hero   || game.fimage || game.cover || "",
      gplatform: game.platform || detectedPlat,
      gcat:      inferCategory(game.info?.Genres || game.info?.Category || ""),
      glink:     game.downloadLinks?.[0]?.url || "",
      gvideo:    trailerUrl || "",   // ← YouTube trailer URL
      othername: [],
    };
    sessionStorage.setItem("scraped_game", JSON.stringify(payload));
    setCopied(true);
    setTimeout(() => { setCopied(false); nav("/add"); }, 800);
  }

  function inferCategory(genres) {
    const g = (genres || "").toLowerCase();
    if (g.includes("sport"))                      return "Sports";
    if (g.includes("simulat"))                    return "Simulation";
    if (g.includes("role") || g.includes("rpg"))  return "Roleplay";
    if (g.includes("action"))                     return "Action";
    if (g.includes("strateg"))                    return "Strategy";
    if (g.includes("casual"))                     return "Casual";
    if (g.includes("puzzle"))                     return "Puzzle";
    if (g.includes("racing"))                     return "Racing";
    return "";
  }

  const platformColor = detectedPlat === "Mobile" ? "#a78bfa" : "#60a5fa";
  const platformIcon  = detectedPlat === "Mobile" ? "📱" : "💻";
  const trailerVideoId = getYouTubeId(trailerUrl);

  return (
    <>
      <Sidebar />
      <div className="scraper-page">

        <div className="scraper-header">
          <h2 className="scraper-title">🔗 Game Link Scraper</h2>
          <p className="scraper-sub">Paste any repack (PC) or APK site (Mobile) URL to auto-fill game data</p>
        </div>

        {/* URL input */}
        <div className="scraper-url-row">
          <div className="scraper-input-wrap">
            <span className="scraper-input-icon">🌐</span>
            <input
              className="scraper-url-input"
              type="url"
              placeholder="https://fitgirl-repacks.site/...  or  https://apkpure.com/..."
              value={inputUrl}
              onChange={e => { setInputUrl(e.target.value); setDetectedPlat(detectPlatform(e.target.value)); }}
              onKeyDown={e => e.key === "Enter" && handleScrape()}
            />
            {inputUrl && (
              <button className="scraper-clear" onClick={() => { setInputUrl(""); setGame(null); setError(null); }}>✕</button>
            )}
          </div>
          <button
            className={`scraper-fetch-btn ${loading ? "loading" : ""}`}
            onClick={handleScrape}
            disabled={loading || !inputUrl.trim()}
          >
            {loading ? <span className="spin" /> : "⬇ Fetch"}
          </button>
        </div>

        {/* Platform indicator */}
        {inputUrl && (
          <div className="platform-detect-badge" style={{ color: platformColor }}>
            {platformIcon} Detected: <strong>{detectedPlat}</strong> game
          </div>
        )}

        {error  && <div className="scraper-error">⚠️ {error}</div>}
        {loading && (
          <div className="scraper-skeleton">
            <div className="sk sk-cover" />
            <div className="sk-lines">
              <div className="sk sk-title" />
              <div className="sk sk-line" />
              <div className="sk sk-line sk-short" />
            </div>
          </div>
        )}

        {game && !loading && (
          <div className="scraper-result">

            {/* Hero row */}
            <div className="scraper-game-hero">
              {game.cover && (
                <img src={game.cover} alt={game.title} className="scraper-cover"
                  onError={e => (e.target.style.display = "none")} />
              )}
              <div className="scraper-game-info">
                <h3 className="scraper-game-name">{game.title}</h3>

                <span className={`platform-badge ${game.platform === "Mobile" ? "badge-mobile" : "badge-pc"}`}
                  style={{ marginBottom: 6, display: "inline-block" }}>
                  {game.platform === "Mobile" ? "📱 Mobile Game" : "💻 PC Game"}
                </span>

                <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer" className="scraper-source-link">
                  {game.sourceUrl}
                </a>

                <div className="scraper-chips" style={{ marginTop: 6 }}>
                  {selectedDesc
                    ? <span className="chip chip-green">✅ Description selected</span>
                    : game.description
                      ? <span className="chip chip-purple">🌐 Description ready</span>
                      : <span className="chip chip-amber">⚠️ No description</span>}
                  {(selectedImages.cover || selectedImages.hero) && <span className="chip chip-green">🖼 Image selected</span>}
                  {game.downloadLinks?.length > 0 && <span className="chip chip-green">⬇ {game.downloadLinks.length} links</span>}
                  {trailerUrl
                    ? <span className="chip chip-green">▶ Trailer ready</span>
                    : <span className="chip chip-amber">⚠️ No trailer</span>}
                </div>

                <button className={`scraper-use-btn ${copied ? "copied" : ""}`} onClick={sendToAddGame}>
                  {copied ? "✓ Redirecting..." : "➕ Use in Add Game"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="scraper-tabs">
              {[
                { id: "info",        label: "📋 Info" },
                { id: "desc",        label: `📝 Description${selectedDesc ? " ✓" : ""}` },
                { id: "trailer",     label: `▶ Trailer${trailerUrl ? " ✓" : ""}` },
                { id: "downloads",   label: `⬇ Downloads (${game.downloadLinks?.length || 0})` },
                { id: "screenshots", label: `🖼 Screenshots (${game.screenshots?.length || 0})` },
                { id: "images",      label: "🔍 Image Search" },
              ].map(t => (
                <button key={t.id} className={`scraper-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            <div className="scraper-tab-body">

              {/* ── Info ── */}
              {tab === "info" && (
                <div className="info-grid">
                  {Object.entries(game.info || {}).length > 0
                    ? Object.entries(game.info).map(([k, v]) => (
                        <div key={k} className="info-card">
                          <span className="info-label">{INFO_MAP[k] || k}</span>
                          <span className="info-value">{v}</span>
                        </div>
                      ))
                    : <p className="scraper-empty">No structured info found.</p>}
                </div>
              )}

              {/* ── Description ── */}
              {tab === "desc" && (
                <div className="img-search-panel">
                  <div className="img-search-row">
                    <input className="img-search-input" type="text"
                      placeholder="Game name to search description..."
                      value={descQuery} onChange={e => setDescQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleDescSearch()} />
                    <button className={`img-search-btn ${descLoading ? "loading" : ""}`}
                      onClick={handleDescSearch} disabled={descLoading || !descQuery.trim()}>
                      {descLoading ? <span className="spin" /> : "🔍 Search"}
                    </button>
                  </div>

                  {selectedDesc && (
                    <div className="img-selected-row">
                      <div className="img-selected-item" style={{ width: "100%" }}>
                        <span className="img-selected-label">✅ Selected Description</span>
                        <p style={{ margin: "6px 0 8px", fontSize: 13, lineHeight: 1.65, color: "#eee" }}>{selectedDesc}</p>
                        <button className="img-deselect" onClick={() => setSelectedDesc("")}>✕ Remove</button>
                      </div>
                    </div>
                  )}

                  {descResults.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                      {descResults.map((r, i) => {
                        const isSelected = selectedDesc === r.text;
                        return (
                          <div key={i} className="img-result-card" style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span className="img-source-badge">{SOURCE_BADGE[r.source] || r.source}</span>
                              <span style={{ fontSize: 11, opacity: 0.45 }}>Option {i + 1}</span>
                            </div>
                            <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.65, color: "#eee" }}>{r.text}</p>
                            <button className={`img-select-btn ${isSelected ? "selected" : ""}`}
                              style={{ width: "100%" }}
                              onClick={() => setSelectedDesc(isSelected ? "" : r.text)}>
                              {isSelected ? "✓ Selected" : "📝 Use this Description"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : !descLoading && <p className="scraper-empty">Click Search to fetch descriptions.</p>}
                </div>
              )}

              {/* ── Trailer ── */}
              {tab === "trailer" && (
                <div className="img-search-panel">

                  {/* Search row */}
                  <div className="img-search-row">
                    <input
                      className="img-search-input"
                      type="text"
                      placeholder="Game name to search YouTube trailer..."
                      value={trailerQuery}
                      onChange={e => setTrailerQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleTrailerSearch()}
                    />
                    <button
                      className={`img-search-btn ${trailerLoading ? "loading" : ""}`}
                      onClick={handleTrailerSearch}
                      disabled={trailerLoading || !trailerQuery.trim()}
                    >
                      {trailerLoading ? <span className="spin" /> : "🔍 Search"}
                    </button>
                  </div>

                  {trailerError && (
                    <div className="scraper-error" style={{ marginTop: 10 }}>⚠️ {trailerError}</div>
                  )}

                  {/* Found trailer preview */}
                  {trailerVideoId && (
                    <div className="trailer-preview-wrap">
                      <div className="trailer-preview-label">
                        <span className="chip chip-green">▶ Trailer Selected</span>
                        <a
                          href={trailerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="scraper-source-link"
                          style={{ fontSize: 12, marginLeft: 10 }}
                        >
                          {trailerUrl}
                        </a>
                      </div>
                      <div className="trailer-iframe-wrap">
                        <iframe
                          src={`https://www.youtube.com/embed/${trailerVideoId}`}
                          title="Game Trailer"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="trailer-iframe"
                        />
                      </div>
                      <button
                        className="img-deselect"
                        style={{ marginTop: 10 }}
                        onClick={() => { setTrailerUrl(""); }}
                      >
                        ✕ Remove Trailer
                      </button>
                    </div>
                  )}

                  {/* Manual paste */}
                  <div className="trailer-manual-wrap">
                    <p className="trailer-manual-label">Or paste a YouTube URL manually:</p>
                    <div className="img-search-row">
                      <input
                        className="img-search-input"
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=...  or  https://youtu.be/..."
                        value={manualTrailer}
                        onChange={e => setManualTrailer(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && applyManualTrailer()}
                      />
                      <button
                        className="img-search-btn"
                        onClick={applyManualTrailer}
                        disabled={!manualTrailer.trim()}
                      >
                        ✓ Apply
                      </button>
                    </div>
                  </div>

                  {!trailerVideoId && !trailerLoading && !trailerError && (
                    <p className="scraper-empty" style={{ marginTop: 20 }}>
                      Click Search to auto-find a trailer, or paste a YouTube URL above.
                    </p>
                  )}
                </div>
              )}

              {/* ── Downloads ── */}
              {tab === "downloads" && (
                <div className="dl-list">
                  {game.magnet && (
                    <div className="magnet-row">
                      <span>🧲 Magnet link available</span>
                      <button onClick={() => navigator.clipboard.writeText(game.magnet)}>📋 Copy</button>
                    </div>
                  )}
                  {game.downloadLinks?.length > 0
                    ? game.downloadLinks.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="dl-item">
                          <span className="dl-num">{String(i + 1).padStart(2, "0")}</span>
                          <span className="dl-label">{l.label || l.url}</span>
                          <span className="dl-arrow">→</span>
                        </a>
                      ))
                    : <p className="scraper-empty">No download links found.</p>}
                </div>
              )}

              {/* ── Screenshots ── */}
              {tab === "screenshots" && (
                <div className="ss-grid">
                  {game.screenshots?.length > 0
                    ? game.screenshots.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                          <img src={src} alt={`Screenshot ${i + 1}`} className="ss-img"
                            onError={e => (e.target.parentElement.style.display = "none")} />
                        </a>
                      ))
                    : <p className="scraper-empty">No screenshots found.</p>}
                </div>
              )}

              {/* ── Image Search ── */}
              {tab === "images" && (
                <div className="img-search-panel">
                  <div className="img-search-row">
                    <input className="img-search-input" type="text"
                      placeholder="Game name to search images..."
                      value={imgQuery} onChange={e => setImgQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleImageSearch()} />
                    <button className={`img-search-btn ${imgLoading ? "loading" : ""}`}
                      onClick={handleImageSearch} disabled={imgLoading || !imgQuery.trim()}>
                      {imgLoading ? <span className="spin" /> : "🔍 Search"}
                    </button>
                  </div>

                  {(selectedImages.cover || selectedImages.hero) && (
                    <div className="img-selected-row">
                      {selectedImages.cover && (
                        <div className="img-selected-item">
                          <span className="img-selected-label">✅ Cover</span>
                          <img src={selectedImages.cover} alt="cover" className="img-selected-thumb" />
                          <button className="img-deselect" onClick={() => setSelectedImages(p => ({ ...p, cover: "" }))}>✕</button>
                        </div>
                      )}
                      {selectedImages.hero && (
                        <div className="img-selected-item">
                          <span className="img-selected-label">✅ Hero</span>
                          <img src={selectedImages.hero} alt="hero" className="img-selected-thumb img-selected-wide" />
                          <button className="img-deselect" onClick={() => setSelectedImages(p => ({ ...p, hero: "" }))}>✕</button>
                        </div>
                      )}
                    </div>
                  )}

                  {imgResults.length > 0 ? (
                    <div className="img-results-grid">
                      {imgResults.map((r, i) => (
                        <div key={i} className="img-result-card">
                          <div className="img-result-name">
                            {r.title}
                            {r.source && <span className="img-source-badge">{SOURCE_BADGE[r.source] || r.source}</span>}
                          </div>
                          <img src={r.cover} alt={r.title} className="img-thumb img-portrait"
                            onError={e => (e.target.style.display = "none")} />
                          <div className="img-btn-row">
                            <SelectBtn url={r.cover} type="cover" selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                            <SelectBtn url={r.cover} type="hero"  selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                          </div>
                          {r.capsule && r.capsule !== r.cover && (
                            <>
                              <img src={r.capsule} alt="capsule" className="img-thumb img-landscape"
                                onError={e => (e.target.style.display = "none")} />
                              <div className="img-btn-row">
                                <SelectBtn url={r.capsule} type="cover" selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                                <SelectBtn url={r.capsule} type="hero"  selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !imgLoading && <p className="scraper-empty">Search for a game to see images.</p>}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}