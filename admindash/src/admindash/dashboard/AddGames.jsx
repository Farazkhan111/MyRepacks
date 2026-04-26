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
  const [gplatform,    setPlatform]  = useState("PC");   // ← NEW
  const [gvideo,       setVideo]     = useState("");
  const [othername,    setOthername] = useState([]);
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
        if (Array.isArray(d.othername)) setOthername(d.othername);
        setAutoFilled(true);
        sessionStorage.removeItem("scraped_game");
      } catch (e) { console.error(e); }
    }
  }, [nav]);

  function addgame(e) {
    e.preventDefault();
    axios.post(`${API}/add`, { gname, gimage, gdes, gcat, gplatform, gfimage, glink, gtrend, gvideo, othername });
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
            <button type="button" className="scraper-shortcut-btn" onClick={() => nav("/scraper")}>
              🔗 Use Scraper
            </button>
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

            <input placeholder="Game Video URL" value={gvideo} onChange={e => setVideo(e.target.value)} />

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

            {/* ── Platform selector ── */}
            <select className="bg-dark" value={gplatform} onChange={e => setPlatform(e.target.value)}>
              <option value="PC">💻 PC</option>
              <option value="Mobile">📱 Mobile</option>
            </select>

            {/* ── Category selector ── */}
            <select className="bg-dark" value={gcat} onChange={e => setCat(e.target.value)}>
              <option value="">Select Category</option>
              {gplatform === "PC" ? (
                <>
                  <option>Roleplay</option>
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
