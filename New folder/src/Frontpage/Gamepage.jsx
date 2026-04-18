import axios from "axios";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import url from "./url";

export default function Gamepage() {
  const [game, setGames] = useState({});
  const loc = useLocation();
  const idd = loc.state;
  const nav = useNavigate();
  const [com, setComments] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.post(url + "/gamepage", { idd }).then((res) => setGames(res.data));
    axios.post(url + "/comments", { idd }).then((res) => setComments(res.data));
  }, [com, idd]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  function down() {
    nav(game.link);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    const newComment = { idd, name, text, date: new Date().toLocaleString() };
    setComments([newComment, ...com]);
    setName("");
    setText("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    axios.post(url + "/newcomments", { idd, name, text, date: new Date().toLocaleString() });
  };

  function deleteComment(id) {
    setComments(com.filter((c) => c._id !== id));
    axios.post(url + "/cdel", { id });
  }

  const avatarColors = [
    "#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#9b5de5",
    "#f72585", "#4cc9f0", "#fb8500", "#06d6a0", "#ef233c",
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Exo+2:wght@300;400;500;600&display=swap');

        .gp-root {
          min-height: 100vh;
          background: #080c14;
          color: #e8eaf0;
          font-family: 'Exo 2', sans-serif;
        }

        /* ── HERO ── */
        .gp-hero {
          position: relative;
          height: 520px;
          overflow: hidden;
        }
        .gp-hero-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center top;
          filter: brightness(0.45) saturate(1.3);
          transform: scale(1.05);
          transition: transform 8s ease;
        }
        .gp-hero:hover .gp-hero-bg {
          transform: scale(1);
        }
        .gp-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(8,12,20,0.1) 0%,
            rgba(8,12,20,0.3) 40%,
            rgba(8,12,20,0.95) 85%,
            #080c14 100%
          );
        }
        .gp-hero-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.07) 2px,
            rgba(0,0,0,0.07) 4px
          );
          pointer-events: none;
        }

        /* ── MAIN CARD ── */
        .gp-main {
          max-width: 960px;
          margin: -110px auto 0;
          padding: 0 24px 60px;
          position: relative;
          z-index: 10;
        }
        .gp-card {
          background: rgba(16, 21, 35, 0.92);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px;
          backdrop-filter: blur(16px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
        }

        /* ── IDENTITY ROW ── */
        .gp-identity {
          display: flex;
          align-items: flex-end;
          gap: 24px;
        }
        .gp-cover {
          width: 110px;
          height: 145px;
          border-radius: 12px;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.12);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
          flex-shrink: 0;
        }
        .gp-title-block { flex: 1; }
        .gp-badge {
          display: inline-block;
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #ff4d6d;
          background: rgba(255, 77, 109, 0.12);
          border: 1px solid rgba(255, 77, 109, 0.3);
          padding: 3px 10px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .gp-name {
          font-family: 'Rajdhani', sans-serif;
          font-size: 2.4rem;
          font-weight: 700;
          line-height: 1.1;
          color: #ffffff;
          letter-spacing: 0.5px;
          margin: 0 0 6px;
        }
        .gp-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
          letter-spacing: 0.5px;
        }

        /* ── DIVIDER ── */
        .gp-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent);
          margin: 28px 0;
        }

        /* ── DESCRIPTION ── */
        .gp-desc {
          font-size: 15px;
          line-height: 1.8;
          color: rgba(232, 234, 240, 0.75);
          font-weight: 300;
          margin: 0 0 28px;
        }

        /* ── DOWNLOAD BUTTON ── */
        .gp-dl-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #e63946, #c1121f);
          color: #fff;
          font-family: 'Rajdhani', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 14px 36px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 4px 24px rgba(230, 57, 70, 0.35), 0 0 0 1px rgba(230,57,70,0.2);
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .gp-dl-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s ease;
        }
        .gp-dl-btn:hover::before { left: 100%; }
        .gp-dl-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(230, 57, 70, 0.5), 0 0 0 1px rgba(230,57,70,0.3);
        }
        .gp-dl-btn:active { transform: translateY(0); }
        .gp-dl-icon {
          width: 18px; height: 18px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        /* ── COMMENTS ── */
        .gp-comments {
          margin-top: 36px;
          background: rgba(12, 16, 28, 0.7);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 28px;
        }
        .gp-comments-title {
          font-family: 'Rajdhani', sans-serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
          margin: 0 0 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .gp-comments-title span {
          background: rgba(230, 57, 70, 0.15);
          color: #ff4d6d;
          border: 1px solid rgba(255, 77, 109, 0.25);
          border-radius: 20px;
          font-size: 12px;
          padding: 2px 10px;
          font-weight: 600;
        }

        /* ── FORM ── */
        .gp-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }
        .gp-input, .gp-textarea {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #e8eaf0;
          font-family: 'Exo 2', sans-serif;
          font-size: 14px;
          padding: 12px 16px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          resize: none;
        }
        .gp-input::placeholder, .gp-textarea::placeholder { color: rgba(255,255,255,0.25); }
        .gp-input:focus, .gp-textarea:focus {
          border-color: rgba(230, 57, 70, 0.5);
          background: rgba(255,255,255,0.06);
        }
        .gp-textarea { min-height: 96px; }
        .gp-post-btn {
          align-self: flex-start;
          background: transparent;
          border: 1px solid rgba(230, 57, 70, 0.5);
          color: #ff4d6d;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 10px 24px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .gp-post-btn:hover {
          background: rgba(230, 57, 70, 0.12);
          border-color: #ff4d6d;
        }
        .gp-post-btn.success {
          border-color: #2a9d8f;
          color: #2a9d8f;
          background: rgba(42, 157, 143, 0.1);
        }

        /* ── COMMENT ITEM ── */
        .gp-comment-list { display: flex; flex-direction: column; gap: 14px; }
        .gp-comment {
          display: flex;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          transition: background 0.2s;
        }
        .gp-comment:hover { background: rgba(255,255,255,0.05); }
        .gp-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: #fff;
          flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.15);
        }
        .gp-comment-body { flex: 1; min-width: 0; }
        .gp-comment-author {
          font-size: 13px;
          font-weight: 600;
          color: #e8eaf0;
          margin-bottom: 4px;
        }
        .gp-comment-text {
          font-size: 13.5px;
          color: rgba(232, 234, 240, 0.7);
          line-height: 1.6;
          word-break: break-word;
        }
        .gp-comment-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }
        .gp-comment-date {
          font-size: 11.5px;
          color: rgba(255,255,255,0.25);
        }
        .gp-del-btn {
          background: none;
          border: none;
          color: rgba(255, 77, 109, 0.4);
          font-size: 11.5px;
          cursor: pointer;
          padding: 0;
          font-family: 'Exo 2', sans-serif;
          transition: color 0.2s;
          letter-spacing: 0.3px;
        }
        .gp-del-btn:hover { color: #ff4d6d; }

        .gp-empty {
          text-align: center;
          padding: 36px 0;
          color: rgba(255,255,255,0.2);
          font-size: 14px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 600px) {
          .gp-identity { flex-direction: column; align-items: flex-start; }
          .gp-cover { width: 80px; height: 105px; }
          .gp-name { font-size: 1.8rem; }
          .gp-hero { height: 320px; }
        }
      `}</style>

      <div className="gp-root">
        {/* Hero */}
        <div className="gp-hero">
          <div className="gp-hero-bg" style={{ backgroundImage: `url(${game.fimage})` }} />
          <div className="gp-hero-overlay" />
          <div className="gp-hero-scanlines" />
        </div>

        {/* Main */}
        <div className="gp-main">
          <div className="gp-card">

            {/* Identity */}
            <div className="gp-identity">
              <img className="gp-cover" src={game.image} alt={game.name} />
              <div className="gp-title-block">
                <div className="gp-badge">Repack</div>
                <h1 className="gp-name">{game.name}</h1>
                <div className="gp-sub">Free Download · Compressed</div>
              </div>
            </div>

            <div className="gp-divider" />

            {/* Description */}
            <p className="gp-desc">{game.description}</p>

            {/* Download */}
            <button className="gp-dl-btn" onClick={down}>
              <svg className="gp-dl-icon" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              Download Now
            </button>

            {/* Comments */}
            <div className="gp-comments">
              <h2 className="gp-comments-title">
                Comments
                {com.length > 0 && <span>{com.length}</span>}
              </h2>

              {/* Form */}
              <div className="gp-form">
                <input
                  className="gp-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <textarea
                  className="gp-textarea"
                  placeholder="Share your thoughts..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  className={`gp-post-btn ${submitted ? "success" : ""}`}
                  onClick={handleSubmit}
                >
                  {submitted ? "✓ Posted" : "Post Comment"}
                </button>
              </div>

              {/* List */}
              <div className="gp-comment-list">
                {com.length === 0 && (
                  <div className="gp-empty">No comments yet — be the first!</div>
                )}
                {com.map((c, index) => (
                  <div key={c._id || index} className="gp-comment">
                    <div
                      className="gp-avatar"
                      style={{ background: avatarColors[index % avatarColors.length] + "33", borderColor: avatarColors[index % avatarColors.length] + "66" }}
                    >
                      <span style={{ color: avatarColors[index % avatarColors.length] }}>
                        {(c.uname || c.name || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="gp-comment-body">
                      <div className="gp-comment-author">{c.uname || c.name}</div>
                      <div className="gp-comment-text">{c.ncom || c.text}</div>
                      <div className="gp-comment-meta">
                        <span className="gp-comment-date">{c.postdate || c.date}</span>
                        <button className="gp-del-btn" onClick={() => deleteComment(c._id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}