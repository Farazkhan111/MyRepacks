import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";

const API = "https://myrepacks.onrender.com";

const INFO_MAP = {
  Genres: "🎮 Genres",
  Tags: "🏷️ Tags",
  Companies: "🏢 Company",
  Company: "🏢 Company",
  Languages: "🌐 Languages",
  "Original Size": "📦 Original Size",
  "Repack Size": "📁 Repack Size",
  "HDD Space": "💾 HDD Space",
  Version: "🔖 Version",
  Crack: "🔓 Crack",
};

const SOURCE_BADGE = {
  steam: "🎮 Steam",
  steam_screenshot: "🎮 Steam SS",
  rawg: "🕹 RAWG",
  rawg_screenshot: "🕹 RAWG SS",
  bing: "🔍 Bing",
};

// Maps descriptionSource value → human readable label for badge + desc tab
const DESC_SOURCE_LABEL = {
  web: { label: "Web Search", badge: "🌐 Web" },
};

export default function GameScraper() {
  const nav = useNavigate();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null);
  const [tab, setTab] = useState("info");

  const [imgQuery, setImgQuery] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResults, setImgResults] = useState([]);
  const [selectedImages, setSelectedImages] = useState({ cover: "", hero: "" });

  const [copied, setCopied] = useState(false);

  // ── Scrape ──────────────────────────────────────────────────────
  async function handleScrape() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setGame(null);
    setImgResults([]);
    setSelectedImages({ cover: "", hero: "" });

    try {
      const res = await fetch(`${API}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Scrape failed");
      setGame(json.data);
      setImgQuery(json.data.title || "");
      setTab("info");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Image search ────────────────────────────────────────────────
  async function handleImageSearch() {
    if (!imgQuery.trim()) return;
    setImgLoading(true);
    setImgResults([]);
    try {
      const res = await fetch(`${API}/imagesuggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: imgQuery.trim() }),
      });
      const json = await res.json();
      setImgResults(json.results || []);
    } catch (e) {
      setImgResults([]);
    } finally {
      setImgLoading(false);
    }
  }

  // ── Send to AddGame ─────────────────────────────────────────────
  function sendToAddGame() {
    if (!game) return;
    const payload = {
      gname: game.title || "",
      gdes: game.description || "",
      gimage: selectedImages.cover || game.cover || "",
      gfimage: selectedImages.hero || game.cover || "",
      gcat: inferCategory(game.info?.Genres || game.info?.Tags || ""),
      glink: game.downloadLinks?.[0]?.url || "",
      othername: [],
    };
    sessionStorage.setItem("scraped_game", JSON.stringify(payload));
    setCopied(true);
    setTimeout(() => { setCopied(false); nav("/add"); }, 800);
  }

  function inferCategory(genres) {
    const g = genres.toLowerCase();
    if (g.includes("sport")) return "Sports";
    if (g.includes("simulat")) return "Simulation";
    if (g.includes("role") || g.includes("rpg")) return "Roleplay";
    return "";
  }

  function SelectBtn({ url, type }) {
    const isSelected = selectedImages[type] === url;
    return (
      <button
        className={`img-select-btn ${isSelected ? "selected" : ""}`}
        onClick={() => setSelectedImages(p => ({ ...p, [type]: isSelected ? "" : url }))}
      >
        {isSelected
          ? `✓ Selected as ${type === "cover" ? "Cover" : "Hero"}`
          : `Set as ${type === "cover" ? "Cover (image)" : "Hero (fimage)"}`}
      </button>
    );
  }

  const descInfo = game?.descriptionSource ? DESC_SOURCE_LABEL[game.descriptionSource] : null;

  return (
    <>
      <Sidebar />
      <div className="scraper-page">

        <div className="scraper-header">
          <h2 className="scraper-title">🔗 Game Link Scraper</h2>
          <p className="scraper-sub">Paste a FitGirl Repacks URL to auto-fill game data</p>
        </div>

        <div className="scraper-url-row">
          <div className="scraper-input-wrap">
            <span className="scraper-input-icon">🌐</span>
            <input
              className="scraper-url-input"
              type="url"
              placeholder="https://fitgirl-repacks.site/game-name/"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleScrape()}
            />
            {url && (
              <button className="scraper-clear" onClick={() => { setUrl(""); setGame(null); setError(null); }}>✕</button>
            )}
          </div>
          <button
            className={`scraper-fetch-btn ${loading ? "loading" : ""}`}
            onClick={handleScrape}
            disabled={loading || !url.trim()}
          >
            {loading ? <span className="spin" /> : "⬇ Fetch"}
          </button>
        </div>

        {error && <div className="scraper-error">⚠️ {error}</div>}

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

            <div className="scraper-game-hero">
              {game.cover && (
                <img src={game.cover} alt={game.title} className="scraper-cover"
                  onError={e => e.target.style.display = "none"} />
              )}
              <div className="scraper-game-info">
                <h3 className="scraper-game-name">{game.title}</h3>
                <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer" className="scraper-source-link">
                  {game.sourceUrl}
                </a>

                {/* Description source badge */}
                {descInfo && (
                  <span className="chip chip-purple" style={{ marginTop: 4 }}>
                    {descInfo.badge}
                  </span>
                )}

                <div className="scraper-chips">
                  {game.info?.["Repack Size"] && <span className="chip chip-amber">📁 {game.info["Repack Size"]}</span>}
                  {game.info?.["Original Size"] && <span className="chip chip-blue">📦 {game.info["Original Size"]}</span>}
                  {game.downloadLinks?.length > 0 && <span className="chip chip-green">⬇ {game.downloadLinks.length} links</span>}
                </div>

                <button className={`scraper-use-btn ${copied ? "copied" : ""}`} onClick={sendToAddGame}>
                  {copied ? "✓ Redirecting..." : "➕ Use in Add Game"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="scraper-tabs">
              {[
                { id: "info", label: "📋 Info" },
                { id: "desc", label: "📝 Description" },
                { id: "downloads", label: `⬇ Downloads (${game.downloadLinks?.length || 0})` },
                { id: "screenshots", label: `🖼 Screenshots (${game.screenshots?.length || 0})` },
                { id: "images", label: "🔍 Image Search" },
              ].map(t => (
                <button key={t.id} className={`scraper-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="scraper-tab-body">

              {/* Info */}
              {tab === "info" && (
                <div className="info-grid">
                  {Object.entries(game.info || {}).length > 0 ? (
                    Object.entries(game.info).map(([k, v]) => (
                      <div key={k} className="info-card">
                        <span className="info-label">{INFO_MAP[k] || k}</span>
                        <span className="info-value">{v}</span>
                      </div>
                    ))
                  ) : (
                    <p className="scraper-empty">No structured info parsed from this page.</p>
                  )}
                </div>
              )}

              {/* Description */}
              {tab === "desc" && (
                <div className="scraper-desc">
                  {game.description ? (
                    <>
                      <p>{game.description}</p>
                      {descInfo && (
                        <p className="scraper-empty" style={{ marginTop: 8 }}>
                          — Source: {descInfo.label}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="scraper-empty">No description found.</p>
                  )}
                </div>
              )}

              {/* Downloads */}
              {tab === "downloads" && (
                <div className="dl-list">
                  {game.magnet && (
                    <div className="magnet-row">
                      <span>🧲 Magnet link available</span>
                      <button onClick={() => navigator.clipboard.writeText(game.magnet)}>📋 Copy</button>
                    </div>
                  )}
                  {game.downloadLinks?.length > 0 ? (
                    game.downloadLinks.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="dl-item">
                        <span className="dl-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="dl-label">{l.label || l.url}</span>
                        <span className="dl-arrow">→</span>
                      </a>
                    ))
                  ) : (
                    <p className="scraper-empty">No download links found.</p>
                  )}
                </div>
              )}

              {/* Screenshots */}
              {tab === "screenshots" && (
                <div className="ss-grid">
                  {game.screenshots?.length > 0 ? (
                    game.screenshots.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                        <img src={src} alt={`Screenshot ${i + 1}`} className="ss-img"
                          onError={e => e.target.parentElement.style.display = "none"} />
                      </a>
                    ))
                  ) : (
                    <p className="scraper-empty">No screenshots found.</p>
                  )}
                </div>
              )}

              {/* Image Search */}
              {tab === "images" && (
                <div className="img-search-panel">
                  <p className="img-search-hint">
                    Search for high-quality game images from Steam, RAWG, and more.
                  </p>
                  <div className="img-search-row">
                    <input
                      className="img-search-input"
                      type="text"
                      placeholder="Game name to search images..."
                      value={imgQuery}
                      onChange={e => setImgQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleImageSearch()}
                    />
                    <button
                      className={`img-search-btn ${imgLoading ? "loading" : ""}`}
                      onClick={handleImageSearch}
                      disabled={imgLoading || !imgQuery.trim()}
                    >
                      {imgLoading ? <span className="spin" /> : "🔍 Search"}
                    </button>
                  </div>

                  {(selectedImages.cover || selectedImages.hero) && (
                    <div className="img-selected-row">
                      {selectedImages.cover && (
                        <div className="img-selected-item">
                          <span className="img-selected-label">✅ Cover (image)</span>
                          <img src={selectedImages.cover} alt="cover" className="img-selected-thumb" />
                          <button className="img-deselect" onClick={() => setSelectedImages(p => ({ ...p, cover: "" }))}>✕ Remove</button>
                        </div>
                      )}
                      {selectedImages.hero && (
                        <div className="img-selected-item">
                          <span className="img-selected-label">✅ Hero (fimage)</span>
                          <img src={selectedImages.hero} alt="hero" className="img-selected-thumb img-selected-wide" />
                          <button className="img-deselect" onClick={() => setSelectedImages(p => ({ ...p, hero: "" }))}>✕ Remove</button>
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
                            onError={e => e.target.style.display = "none"} />
                          <div className="img-btn-row">
                            <SelectBtn url={r.cover} type="cover" />
                            <SelectBtn url={r.cover} type="hero" />
                          </div>

                          {r.capsule && r.capsule !== r.cover && (
                            <>
                              <span className="img-result-section-label" style={{ marginTop: 8, display: "block" }}>Landscape Header</span>
                              <img src={r.capsule} alt={`${r.title} header`} className="img-thumb img-landscape"
                                onError={e => e.target.style.display = "none"} />
                              <div className="img-btn-row">
                                <SelectBtn url={r.capsule} type="cover" />
                                <SelectBtn url={r.capsule} type="hero" />
                              </div>
                            </>
                          )}

                          {r.hero && r.hero !== r.cover && r.hero !== r.capsule && (
                            <>
                              <span className="img-result-section-label" style={{ marginTop: 8, display: "block" }}>Hero Banner</span>
                              <img src={r.hero} alt={`${r.title} hero`} className="img-thumb img-landscape"
                                onError={e => e.target.style.display = "none"} />
                              <div className="img-btn-row">
                                <SelectBtn url={r.hero} type="cover" />
                                <SelectBtn url={r.hero} type="hero" />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !imgLoading && <p className="scraper-empty">Search for a game to see high-quality images.</p>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}