import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import url from "./url/url";

const API = url;

export default function Edit() {
  const [gname,     setName]    = useState("");
  const [gimage,    setImage]   = useState("");
  const [gfimage,   setFimage]  = useState("");
  const [gdes,      setDes]     = useState("");
  const [gcat,      setCat]     = useState("");
  const [gplatform, setPlatform]= useState("PC");  // ← NEW
  const [gtrend,    setTrend]   = useState("");
  const [glink,     setLink]    = useState("");
  const [gvideo,    setVideo]   = useState("");
  const [othername, setOther]   = useState([]);
  const [alias,     setAlias]   = useState("");

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
    });
  }, [id, nav]);

  function update(e) {
    e.preventDefault();
    axios.post(`${API}/gupdate`, { id, gname, gimage, gfimage, gdes, gcat, gplatform, gtrend, glink, gvideo, othername });
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

  return (
    <>
      <Sidebar />
      <div className="addgames-main-content">
        <div className="addgames-form-container">
          <div className="addgames-header-row">
            <h2>✏️ Edit Game</h2>
          </div>

          <form onSubmit={update}>
            <input placeholder="Game Name" value={gname} onChange={e => setName(e.target.value)} />

            <div className="input-with-preview">
              <input placeholder="Cover Image URL" value={gimage} onChange={e => setImage(e.target.value)} />
              {gimage && <img src={gimage} alt="cover" className="img-preview img-preview-portrait" onError={e => e.target.style.display="none"} />}
            </div>

            <div className="input-with-preview">
              <input placeholder="Hero Image URL" value={gfimage} onChange={e => setFimage(e.target.value)} />
              {gfimage && <img src={gfimage} alt="hero" className="img-preview img-preview-landscape" onError={e => e.target.style.display="none"} />}
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

            {/* Platform */}
            <select className="bg-dark" value={gplatform} onChange={e => setPlatform(e.target.value)}>
              <option value="PC">💻 PC</option>
              <option value="Mobile">📱 Mobile</option>
            </select>

            {/* Category (changes based on platform) */}
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

            <button type="submit">💾 Update Game</button>
          </form>
        </div>
      </div>
    </>
  );
}
