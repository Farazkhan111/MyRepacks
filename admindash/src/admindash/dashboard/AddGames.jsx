import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://myrepacks.onrender.com";

export default function AddGames() {
  const [gname, setName] = useState("");
  const [gimage, setImage] = useState("");
  const [glink, setLink] = useState("");
  const [gfimage, setFimage] = useState("");
  const [gdes, setDes] = useState("");
  const [gcat, setCat] = useState("");
  const [gvideo, setVideo] = useState("");
  const [othername, setOthername] = useState([]);
  const [gtrend, setTrend] = useState("");
  const [currentAlias, setCurrentAlias] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  const nav = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("admin");
    if (!user) nav("/");

    // ── Auto-fill from scraper if data exists ──
    const scraped = sessionStorage.getItem("scraped_game");
    if (scraped) {
      try {
        const d = JSON.parse(scraped);
        if (d.gname) setName(d.gname);
        if (d.gdes) setDes(d.gdes);
        if (d.gimage) setImage(d.gimage);
        if (d.gfimage) setFimage(d.gfimage);
        if (d.gcat) setCat(d.gcat);
        if (d.glink) setLink(d.glink);
        if (Array.isArray(d.othername)) setOthername(d.othername);
        setAutoFilled(true);
        sessionStorage.removeItem("scraped_game");
      } catch (e) {
        console.error("Failed to parse scraped game data", e);
      }
    }
  }, [nav]);

  function addgame(e) {
    e.preventDefault();
    axios
      .post(`${API}/add`, { gname, gimage, gdes, gcat, gfimage, glink, gtrend, gvideo, othername })
      .then(() => alert("Game added successfully"))
      .catch(() => alert("Error adding game"));
  }

  const handleAddName = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentAlias.trim() && !othername.includes(currentAlias.trim())) {
        setOthername([...othername, currentAlias.trim()]);
        setCurrentAlias("");
      }
    }
  };

  const removeName = (i) => {
    setOthername(othername.filter((_, idx) => idx !== i));
  };

  return (
    <>
      <Sidebar />
      <div className="addgames-main-content">
        <div className="addgames-form-container">

          {/* Auto-fill banner */}
          {autoFilled && (
            <div className="autofill-banner">
              ✅ Form auto-filled from scraper — review and submit!
            </div>
          )}

          <div className="addgames-header-row">
            <h2>🎮 Add New Game</h2>
            <button
              type="button"
              className="scraper-shortcut-btn"
              onClick={() => nav("/scraper")}
            >
              🔗 Use Scraper
            </button>
          </div>

          <form onSubmit={addgame}>
            <input
              placeholder="Game Name"
              value={gname}
              onChange={e => setName(e.target.value)}
            />

            {/* Image URL with preview */}
            <div className="input-with-preview">
              <input
                placeholder="Game Image URL (portrait cover)"
                value={gimage}
                onChange={e => setImage(e.target.value)}
              />
              {gimage && (
                <img
                  src={gimage}
                  alt="cover preview"
                  className="img-preview img-preview-portrait"
                  onError={e => e.target.style.display = "none"}
                />
              )}
            </div>

            <div className="input-with-preview">
              <input
                placeholder="Full Image URL (landscape hero)"
                value={gfimage}
                onChange={e => setFimage(e.target.value)}
              />
              {gfimage && (
                <img
                  src={gfimage}
                  alt="hero preview"
                  className="img-preview img-preview-landscape"
                  onError={e => e.target.style.display = "none"}
                />
              )}
            </div>

            <input
              placeholder="Game Video URL"
              value={gvideo}
              onChange={e => setVideo(e.target.value)}
            />

            {/* Alias tags */}
            <div className="addgames-alias-box">
              {othername.map((name, i) => (
                <span key={i} className="addgames-tag">
                  {name}
                  <button type="button" onClick={() => removeName(i)}>×</button>
                </span>
              ))}
              <input
                placeholder="Add aliases (press Enter)..."
                value={currentAlias}
                onChange={e => setCurrentAlias(e.target.value)}
                onKeyDown={handleAddName}
              />
            </div>

            <textarea
              placeholder="Game Description"
              value={gdes}
              onChange={e => setDes(e.target.value)}
            />

            <select value={gcat} onChange={e => setCat(e.target.value)}>
              <option value="">Select Category</option>
              <option>Roleplay</option>
              <option>Simulation</option>
              <option>Sports</option>
            </select>

            <select value={gtrend} onChange={e => setTrend(e.target.value)}>
              <option value="">Select Trending</option>
              <option>Trending</option>
              <option>Not Trending</option>
            </select>

            <input
              placeholder="Download Link"
              value={glink}
              onChange={e => setLink(e.target.value)}
            />

            <button type="submit">🚀 Add Game</button>
          </form>
        </div>
      </div>
    </>
  );
}
