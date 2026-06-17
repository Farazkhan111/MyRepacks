import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import url from "./url/url";

const API = url;

export default function AddGames() {
  const [gname,        setName]      = useState("");
  const [gimage,       setImage]     = useState("");
  const [glink,        setLink]      = useState("");
  const [gfimage,      setFimage]    = useState("");
  const [gdes,         setDes]       = useState("");
  const [gcat,         setCat]       = useState("");
  const [gplatform,    setPlatform]  = useState("PC");
  const [gvideo,       setVideo]     = useState("");
  const [othername,    setOthername] = useState([]);
  const [gscreenshots, setScreenshots] = useState([]);   // screenshot URLs to save with the game
  const [currentShot,  setCurrentShot] = useState("");
  const [gtrend,       setTrend]     = useState("");
  const [currentAlias, setAlias]     = useState("");
  const [autoFilled,   setAutoFilled]= useState(false);

  const nav = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("admin");
    if (!user) nav("/");

    const scraped = sessionStorage.getItem("scraped_game");
    if (scraped) {
      try {
        const d = JSON.parse(scraped);
        if (d.gname)     setName(d.gname);
        if (d.gdes)      setDes(d.gdes);
        if (d.gimage)    setImage(d.gimage);
        if (d.gfimage)   setFimage(d.gfimage);
        if (d.gcat)      setCat(d.gcat);
        if (d.gplatform) setPlatform(d.gplatform);
        if (d.glink)     setLink(d.glink);
        if (d.gvideo)    setVideo(d.gvideo);   // ← trailer URL from scraper
        if (Array.isArray(d.othername)) setOthername(d.othername);
        if (Array.isArray(d.gscreenshots)) setScreenshots(d.gscreenshots);   // ← screenshots from scraper
        setAutoFilled(true);
        // ⚠️ Do NOT remove scraped_game here — keep it so Back button restores scraper state
      } catch (e) { console.error(e); }
    }
  }, [nav]);

  async function addgame(e) {
    e.preventDefault();
    await axios.post(`${API}/add`, { gname, gimage, gdes, gcat, gplatform, gfimage, glink, gtrend, gvideo, othername, gscreenshots });
    // Only clear scraper data after the game is successfully saved to DB
    sessionStorage.removeItem("scraped_game");
    nav("/show");
  }

  const handleAddAlias = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentAlias.trim() && !othername.includes(currentAlias.trim())) {
        setOthername([...othername, currentAlias.trim()]);
        setAlias("");
      }
    }
  };

  // Extract YouTube video ID for preview
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

  const videoId = getYouTubeId(gvideo);

  return (
    <>
      <Sidebar />
      <div className="addgames-main-content">
        <div className="addgames-form-container">

          {autoFilled && (
            <div className="autofill-banner">
              ✅ Form auto-filled from scraper — review and submit!
            </div>
          )}

          <div className="addgames-header-row">
            <h2>🎮 Add New Game</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {autoFilled && (
                <button type="button" className="scraper-shortcut-btn" onClick={() => nav("/scraper")}>
                  ← Back to Scraper
                </button>
              )}
              <button type="button" className="scraper-shortcut-btn" onClick={() => nav("/scraper")}>
                🔗 Use Scraper
              </button>
            </div>
          </div>

          <form onSubmit={addgame}>
            <input placeholder="Game Name" value={gname} onChange={e => setName(e.target.value)} />

            <div className="input-with-preview">
              <input placeholder="Cover Image URL (portrait)" value={gimage} onChange={e => setImage(e.target.value)} />
              {gimage && <img src={gimage} alt="cover" className="img-preview img-preview-portrait" onError={e => e.target.style.display="none"} />}
            </div>

            <div className="input-with-preview">
              <input placeholder="Hero Image URL (landscape)" value={gfimage} onChange={e => setFimage(e.target.value)} />
              {gfimage && <img src={gfimage} alt="hero" className="img-preview img-preview-landscape" onError={e => e.target.style.display="none"} />}
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
                      <img src={src} alt={`Screenshot ${i + 1}`} onError={e => (e.target.parentElement.style.display = "none")} />
                      <button type="button" onClick={() => setScreenshots(gscreenshots.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Video URL + live preview ── */}
            <div className="input-with-preview">
              <input
                placeholder="YouTube Trailer URL (e.g. https://youtube.com/watch?v=...)"
                value={gvideo}
                onChange={e => setVideo(e.target.value)}
              />
              {videoId && (
                <div className="video-preview-wrap">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="Trailer preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="video-preview-iframe"
                  />
                  <button
                    type="button"
                    className="video-preview-clear"
                    onClick={() => setVideo("")}
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>

            {/* Aliases */}
            <div className="addgames-alias-box">
              {othername.map((n, i) => (
                <span key={i} className="addgames-tag">
                  {n}
                  <button type="button" onClick={() => setOthername(othername.filter((_, idx) => idx !== i))}>×</button>
                </span>
              ))}
              <input
                placeholder="Add aliases (press Enter)..."
                value={currentAlias}
                onChange={e => setAlias(e.target.value)}
                onKeyDown={handleAddAlias}
              />
            </div>

            <textarea placeholder="Game Description" value={gdes} onChange={e => setDes(e.target.value)} />

            {/* Platform selector */}
            <select className="bg-dark" value={gplatform} onChange={e => setPlatform(e.target.value)}>
              <option value="PC">💻 PC</option>
              <option value="Mobile">📱 Mobile</option>
            </select>

            {/* Category selector */}
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

            <button type="submit">🚀 Add Game</button>
          </form>
        </div>
      </div>
    </>
  );
}