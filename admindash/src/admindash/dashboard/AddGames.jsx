import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import axios from "axios";


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

  const nav = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("admin");
    if (!user) nav("/");
  }, [nav]);

  function addgame(e) {
    e.preventDefault();
    axios
      .post("https://myrepacks.onrender.com/add", {
        gname,
        gimage,
        gdes,
        gcat,
        gfimage,
        glink,
        gtrend,
        gvideo,
        othername,
      })
      .then(() => alert("Game added successfully"))
      .catch(() => alert("Error adding game"));
  }

  const handleAddName = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentAlias.trim() && !othername.includes(currentAlias)) {
        setOthername([...othername, currentAlias.trim()]);
        setCurrentAlias("");
      }
    }
  };

  const removeName = (i) => {
    setOthername(othername.filter((_, index) => index !== i));
  };

  return (
    <>
      <Sidebar />

      <div className="addgames-main-content">
        <div className="addgames-form-container">
          <h2>🎮 Add New Game</h2>

          <form onSubmit={addgame}>
            <input
              placeholder="Game Name"
              value={gname}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Game Image URL"
              value={gimage}
              onChange={(e) => setImage(e.target.value)}
            />
            <input
              placeholder="Full Image URL"
              value={gfimage}
              onChange={(e) => setFimage(e.target.value)}
            />
            <input
              placeholder="Game Video URL"
              value={gvideo}
              onChange={(e) => setVideo(e.target.value)}
            />

            {/* Alias */}
            <div className="addgames-alias-box">
              {othername.map((name, i) => (
                <span key={i} className="addgames-tag">
                  {name}
                  <button type="button" onClick={() => removeName(i)}>
                    ×
                  </button>
                </span>
              ))}

              <input
                placeholder="Add aliases..."
                value={currentAlias}
                onChange={(e) => setCurrentAlias(e.target.value)}
                onKeyDown={handleAddName}
              />
            </div>

            <textarea
              placeholder="Game Description"
              value={gdes}
              onChange={(e) => setDes(e.target.value)}
            />

            <select onChange={(e) => setCat(e.target.value)}>
              <option>Select Category</option>
              <option>Roleplay</option>
              <option>Simulation</option>
              <option>Sports</option>
            </select>

            <select onChange={(e) => setTrend(e.target.value)}>
              <option>Select Trending</option>
              <option>Trending</option>
              <option>Not Trending</option>
            </select>

            <input
              placeholder="Download Link"
              value={glink}
              onChange={(e) => setLink(e.target.value)}
            />

            <button type="submit">🚀 Add Game</button>
          </form>
        </div>
      </div>
    </>
  );
}