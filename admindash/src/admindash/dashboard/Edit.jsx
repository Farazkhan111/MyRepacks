import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import url from "./url/url";

const API = url;

// ── Reusable select button (same as GameScraper) ─────────────────
function SelectBtn({ url, type, selectedImages, setSelectedImages }) {
  const isSelected = selectedImages[type] === url;
  return (
    <button
      type="button"
      className={`img-select-btn ${isSelected ? "selected" : ""}`}
      onClick={() => setSelectedImages(prev => ({ ...prev, [type]: isSelected ? "" : url }))}
    >
      {isSelected
        ? `✓ Selected as ${type === "cover" ? "Cover" : "Hero"}`
        : `Set as ${type === "cover" ? "Cover" : "Hero"}`}
    </button>
  );
}

// ── Image Search Modal ────────────────────────────────────────────
function ImageSearchModal({ gameName, platform, onApply, onClose }) {
  const [query,          setQuery]          = useState(gameName || "");
  const [imgLoading,     setImgLoading]     = useState(false);
  const [imgResults,     setImgResults]     = useState([]);
  const [selectedImages, setSelectedImages] = useState({ cover: "", hero: "" });

  const SOURCE_BADGE = {
    steam:      "🎮 Steam",
    steamgriddb:"🎮 SteamGridDB",
    igdb:       "🕹 IGDB",
    rawg:       "🌐 RAWG",
    playstore:  "▶ Play Store",
    ai:         "🤖 AI",
    web:        "🌐 Web",
  };

  async function handleSearch() {
    if (!query.trim()) return;
    setImgLoading(true);
    setImgResults([]);
    try {
      const res  = await fetch(`${API}/imagesuggest`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ gameName: query.trim(), platform: platform || "PC" }),
      });
      const json = await res.json();
      setImgResults(json.results || []);
    } catch (_) {
      setImgResults([]);
    } finally {
      setImgLoading(false);
    }
  }

  function handleApply() {
    onApply(selectedImages);
    onClose();
  }

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="edit-img-modal-backdrop" onClick={handleBackdrop}>
      <div className="edit-img-modal">
        {/* Header */}
        <div className="edit-img-modal-header">
          <span>🔍 Image Search</span>
          <button type="button" className="edit-img-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Search row */}
        <div className="img-search-row" style={{ marginBottom: 16 }}>
          <input
            className="img-search-input"
            type="text"
            placeholder="Game name to search images…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          <button
            type="button"
            className={`img-search-btn ${imgLoading ? "loading" : ""}`}
            onClick={handleSearch}
            disabled={imgLoading || !query.trim()}
          >
            {imgLoading ? <span className="spin" /> : "🔍 Search"}
          </button>
        </div>

        {/* Selected images preview */}
        {(selectedImages.cover || selectedImages.hero) && (
          <div className="img-selected-row" style={{ marginBottom: 16 }}>
            {selectedImages.cover && (
              <div className="img-selected-item">
                <span className="img-selected-label">✅ Cover</span>
                <img src={selectedImages.cover} alt="cover" className="img-selected-thumb" />
                <button type="button" className="img-deselect"
                  onClick={() => setSelectedImages(p => ({ ...p, cover: "" }))}>✕</button>
              </div>
            )}
            {selectedImages.hero && (
              <div className="img-selected-item">
                <span className="img-selected-label">✅ Hero</span>
                <img src={selectedImages.hero} alt="hero" className="img-selected-thumb img-selected-wide" />
                <button type="button" className="img-deselect"
                  onClick={() => setSelectedImages(p => ({ ...p, hero: "" }))}>✕</button>
              </div>
            )}
          </div>
        )}

        {/* Results grid */}
        <div className="edit-img-modal-body">
          {imgResults.length > 0 ? (
            <div className="img-results-grid">
              {imgResults.map((r, i) => (
                <div key={i} className="img-result-card">
                  <div className="img-result-name">
                    {r.title}
                    {r.source && (
                      <span className="img-source-badge">
                        {SOURCE_BADGE[r.source] || r.source}
                      </span>
                    )}
                  </div>

                  {/* Cover / portrait image */}
                  {r.cover && (
                    <>
                      <img src={r.cover} alt={r.title}
                        className="img-thumb img-portrait"
                        onError={e => (e.target.style.display = "none")} />
                      <div className="img-btn-row">
                        <SelectBtn url={r.cover} type="cover" selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                        <SelectBtn url={r.cover} type="hero"  selectedImages={selectedImages} setSelectedImages={setSelectedImages} />
                      </div>
                    </>
                  )}

                  {/* Capsule / landscape image */}
                  {r.capsule && r.capsule !== r.cover && (
                    <>
                      <img src={r.capsule} alt="capsule"
                        className="img-thumb img-landscape"
                        style={{ marginTop: 8 }}
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
          ) : imgLoading ? null : (
            <p className="scraper-empty">
              {imgResults.length === 0 && !imgLoading
                ? "Search for a game to see images."
                : ""}
            </p>
          )}
        </div>

        {/* Footer apply */}
        <div className="edit-img-modal-footer">
          <button type="button" className="edit-img-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="edit-img-apply-btn"
            disabled={!selectedImages.cover && !selectedImages.hero}
            onClick={handleApply}
          >
            ✅ Apply Selected Images
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Edit Component ───────────────────────────────────────────
export default function Edit() {
  const [gname,        setName]       = useState("");
  const [gimage,       setImage]      = useState("");
  const [gfimage,      setFimage]     = useState("");
  const [gdes,         setDes]        = useState("");
  const [gcat,         setCat]        = useState("");
  const [gplatform,    setPlatform]   = useState("PC");
  const [gtrend,       setTrend]      = useState("");
  const [glink,        setLink]       = useState("");
  const [gvideo,       setVideo]      = useState("");
  const [othername,    setOther]      = useState([]);
  const [alias,        setAlias]      = useState("");
  const [gscreenshots, setScreenshots]= useState([]);
  const [currentShot,  setCurrentShot]= useState("");

  // Image search modal state
  const [showImgSearch, setShowImgSearch] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const id  = loc.state;

  useEffect(() => {
    if (!localStorage.getItem("admin")) nav("/");
    if (!id) return;
    axios.post(`${API}/edit`, { id }).then(res => {
      const g = res.data;
      setName(g.name || "");
      setImage(g.image || "");
      setFimage(g.fimage || "");
      setDes(g.description || "");
      setCat(g.category || "");
      setPlatform(g.platform || "PC");
      setTrend(g.trending || "");
      setLink(g.link || "");
      setVideo(g.video || "");
      setOther(g.othername || []);
      setScreenshots(
        Array.isArray(g.images)
          ? g.images.filter(i => i.type === "screenshot" && i.url).map(i => i.url)
          : []
      );
    });
  }, [id, nav]);

  function update(e) {
    e.preventDefault();
    axios.post(`${API}/gupdate`, {
      id, gname, gimage, gfimage, gdes, gcat, gplatform, gtrend, glink, gvideo, othername, gscreenshots,
    });
    nav("/show");
  }

  const addAlias = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (alias.trim() && !othername.includes(alias.trim())) {
        setOther([...othername, alias.trim()]);
        setAlias("");
      }
    }
  };

  // Called when user clicks "Apply" in the modal
  function handleImgApply(selected) {
    if (selected.cover) setImage(selected.cover);
    if (selected.hero)  setFimage(selected.hero);
  }

  return (
    <>
      <Sidebar />
      <div className="addgames-main-content">
        <div className="addgames-form-container">
          <div className="addgames-header-row">
            <button className="edit-back-btn" type="button" onClick={() => nav(-1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>
            <h2>✏️ Edit Game</h2>
          </div>

          <form onSubmit={update}>
            <input placeholder="Game Name" value={gname} onChange={e => setName(e.target.value)} />

            {/* ── Cover Image ── */}
            <div className="input-with-preview">
              <div className="edit-img-field-row">
                <input
                  placeholder="Cover Image URL"
                  value={gimage}
                  onChange={e => setImage(e.target.value)}
                />
                <button
                  type="button"
                  className="edit-img-search-trigger"
                  title="Search images"
                  onClick={() => setShowImgSearch(true)}
                >
                  🔍
                </button>
              </div>
              {gimage && (
                <img src={gimage} alt="cover" className="img-preview img-preview-portrait"
                  onError={e => (e.target.style.display = "none")} />
              )}
            </div>

            {/* ── Hero Image ── */}
            <div className="input-with-preview">
              <div className="edit-img-field-row">
                <input
                  placeholder="Hero Image URL"
                  value={gfimage}
                  onChange={e => setFimage(e.target.value)}
                />
                <button
                  type="button"
                  className="edit-img-search-trigger"
                  title="Search images"
                  onClick={() => setShowImgSearch(true)}
                >
                  🔍
                </button>
              </div>
              {gfimage && (
                <img src={gfimage} alt="hero" className="img-preview img-preview-landscape"
                  onError={e => (e.target.style.display = "none")} />
              )}
            </div>

            {/* Screenshots */}
            <div className="addgames-shots-box">
              <input
                placeholder="Add screenshot URL (press Enter)..."
                value={currentShot}
                onChange={e => setCurrentShot(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = currentShot.trim();
                    if (v && !gscreenshots.includes(v)) setScreenshots([...gscreenshots, v]);
                    setCurrentShot("");
                  }
                }}
              />
              {gscreenshots.length > 0 && (
                <div className="addgames-shots-grid">
                  {gscreenshots.map((src, i) => (
                    <div key={i} className="addgames-shot-thumb">
                      <img src={src} alt={`Screenshot ${i + 1}`}
                        onError={e => (e.target.parentElement.style.display = "none")} />
                      <button type="button"
                        onClick={() => setScreenshots(gscreenshots.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input placeholder="Video URL" value={gvideo} onChange={e => setVideo(e.target.value)} />

            <div className="addgames-alias-box">
              {othername.map((n, i) => (
                <span key={i} className="addgames-tag">
                  {n}
                  <button type="button" onClick={() => setOther(othername.filter((_, idx) => idx !== i))}>×</button>
                </span>
              ))}
              <input
                placeholder="Add aliases (press Enter)..."
                value={alias}
                onChange={e => setAlias(e.target.value)}
                onKeyDown={addAlias}
              />
            </div>

            <textarea placeholder="Description" value={gdes} onChange={e => setDes(e.target.value)} />

            <select className="bg-dark" value={gplatform} onChange={e => setPlatform(e.target.value)}>
              <option value="PC">💻 PC</option>
              <option value="Mobile">📱 Mobile</option>
            </select>

            <select className="bg-dark" value={gcat} onChange={e => setCat(e.target.value)}>
              <option value="">Select Category</option>
              {gplatform === "PC" ? (
                <>
                  <option>RPG</option>
                  <option>Simulation</option>
                  <option>Sports</option>
                  <option>Action</option>
                  <option>Strategy</option>
                  <option>Adventure</option>
                </>
              ) : (
                <>
                  <option>Action</option>
                  <option>Casual</option>
                  <option>Simulation</option>
                  <option>Puzzle</option>
                  <option>Racing</option>
                  <option>RPG</option>
                  <option>Sports</option>
                  <option>Strategy</option>
                </>
              )}
            </select>

            <select className="bg-dark" value={gtrend} onChange={e => setTrend(e.target.value)}>
              <option value="">Select Trending</option>
              <option>Trending</option>
              <option>Not Trending</option>
            </select>

            <input placeholder="Download Link" value={glink} onChange={e => setLink(e.target.value)} />

            <button type="submit">💾 Update Game</button>
          </form>
        </div>
      </div>

      {/* Image Search Modal */}
      {showImgSearch && (
        <ImageSearchModal
          gameName={gname}
          platform={gplatform}
          onApply={handleImgApply}
          onClose={() => setShowImgSearch(false)}
        />
      )}
    </>
  );
}
