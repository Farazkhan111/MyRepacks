import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Edit() {
  const location = useLocation();
  const id = location.state;
  const nav = useNavigate();

  const [gname, setName] = useState("");
  const [gimage, setImage] = useState("");
  const [gfimage, setFimage] = useState("");
  const [gvideo, setVideo] = useState("");
  const [glink, setLink] = useState("");
  const [gdes, setDes] = useState("");
  const [gcat, setCat] = useState("");
  const [othername, setOthername] = useState([]);
  const [currentAlias, setCurrentAlias] = useState("");

  useEffect(() => {
    axios.post("https://myrepacks.onrender.com/edit", { id })
      .then((res) => {
        setName(res.data.name);
        setImage(res.data.image);
        setFimage(res.data.fimage);
        setVideo(res.data.video);
        setLink(res.data.link);
        setDes(res.data.description);
        setCat(res.data.category);
        setOthername(res.data.othername || []);
      });
  }, [id]);

  function update(e) {
    e.preventDefault();

    axios.post("https://myrepacks.onrender.com/gupdate", {
      id, gname, gimage, gdes, gcat, gfimage, glink, gvideo, othername
    }).then(() => nav("/show"));
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

      <div className="main-content add-page">

        <div className="form-container edit-container">

          <h2>✏️ Edit Game</h2>

          {/* Preview */}
          {gimage && (
            <div className="preview">
              <img src={gimage} alt="preview" />
              <p>Live Preview</p>
            </div>
          )}

          <form onSubmit={update}>

            <input value={gname} onChange={(e)=>setName(e.target.value)} placeholder="Game Name" />

            <input value={gimage} onChange={(e)=>setImage(e.target.value)} placeholder="Game Image URL" />

            <input value={gfimage} onChange={(e)=>setFimage(e.target.value)} placeholder="Feature Image URL" />

            <input value={gvideo} onChange={(e)=>setVideo(e.target.value)} placeholder="Video URL" />

            {/* Alias */}
            <div className="alias-box">
              {othername.map((name, i) => (
                <span key={i} className="tag">
                  {name}
                  <button type="button" onClick={()=>removeName(i)}>×</button>
                </span>
              ))}

              <input
                placeholder="Add aliases..."
                value={currentAlias}
                onChange={(e)=>setCurrentAlias(e.target.value)}
                onKeyDown={handleAddName}
              />
            </div>

            <textarea value={gdes} onChange={(e)=>setDes(e.target.value)} placeholder="Description" />

            <select value={gcat} onChange={(e)=>setCat(e.target.value)}>
              <option value="">Select Category</option>
              <option value="Roleplay">Roleplay</option>
              <option value="Simulation">Simulation</option>
              <option value="Sports">Sports</option>
            </select>

            <input value={glink} onChange={(e)=>setLink(e.target.value)} placeholder="Download Link" />

            <button type="submit">💾 Update Game</button>

          </form>

        </div>

      </div>
    </>
  );
}