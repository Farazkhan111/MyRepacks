import axios from 'axios'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import url from './url'


const AVATAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5',
  '#f72585', '#4cc9f0', '#fb8500', '#06d6a0', '#ef233c',
]

export default function Gamepage() {
  const [game, setGame] = useState({})
  const [com, setComments] = useState([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const loc = useLocation()
  const idd = loc.state
  const nav = useNavigate()

  useEffect(() => {
    axios.post(url + '/gamepage', { idd }).then((res) => setGame(res.data))
    axios.post(url + '/comments', { idd }).then((res) => setComments(res.data))
  }, [idd])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  function down() { nav(game.link) }

  const handleSubmit = () => {
    if (!name.trim() || !text.trim()) return
    const newComment = { idd, name, text, date: new Date().toLocaleString() }
    setComments([newComment, ...com])
    setName(''); setText('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2500)
    axios.post(url + '/newcomments', { idd, name, text, date: new Date().toLocaleString() })
  }

  function deleteComment(id) {
    setComments(com.filter((c) => c._id !== id))
    axios.post(url + '/cdel', { id })
  }

  return (
    <div className="gp-page">
      {/* Hero banner */}
      <div className="gp-hero">
        <div
          className="gp-hero-bg"
          style={{ backgroundImage: `url(${game.fimage})` }}
        />
        <div className="gp-hero-overlay" />
        <div className="gp-hero-scanlines" />
      </div>

      {/* Main content */}
      <div className="gp-main">
        {/* Identity card */}
        <div className="gp-identity-row">
          <img
            src={game.image}
            alt={game.name}
            className="gp-cover-img"
          />
          <div className="gp-title-block">
            {game.category && (
              <span className="gp-category-tag">{game.category}</span>
            )}
            <h1 className="gp-game-title">{game.name}</h1>
            <p className="gp-game-sub">Free Download · Compressed · Virus-free</p>

            {/* Meta row */}
            <div className="gp-meta-row">
              <span className="gp-meta-chip gp-chip-green">✓ Safe</span>
              <span className="gp-meta-chip gp-chip-amber">Repack</span>
              <span className="gp-meta-chip gp-chip-blue">Free</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="gp-divider" />

        {/* Description */}
        {game.description && (
          <div className="gp-desc-block">
            <h2 className="gp-block-title">About</h2>
            <p className="gp-description">{game.description}</p>
          </div>
        )}

        {/* Download button */}
        <button className="gp-dl-btn" onClick={down}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Download Now — Free
        </button>
        <p className="gp-dl-note">🔒 Virus-free · Fully repacked · No registration needed</p>

        {/* Divider */}
        <div className="gp-divider" />

        {/* Comments */}
        <div className="gp-comments-block">
          <h2 className="gp-block-title">
            Comments
            {com.length > 0 && (
              <span className="gp-comment-count">{com.length}</span>
            )}
          </h2>

          {/* Comment form */}
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
              placeholder="Share your thoughts about this game..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
            />
            <button
              className={`gp-post-btn ${submitted ? 'submitted' : ''}`}
              onClick={handleSubmit}
            >
              {submitted ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Posted!
                </>
              ) : 'Post Comment'}
            </button>
          </div>

          {/* Comment list */}
          <div className="gp-comment-list">
            {com.length === 0 ? (
              <div className="gp-no-comments">
                <span>No comments yet.</span>
                <span className="gp-no-comments-sub">Be the first to share your thoughts!</span>
              </div>
            ) : (
              com.map((c, index) => (
                <div key={c._id || index} className="gp-comment">
                  <div
                    className="gp-avatar"
                    style={{
                      background: AVATAR_COLORS[index % AVATAR_COLORS.length] + '18',
                      border: `1px solid ${AVATAR_COLORS[index % AVATAR_COLORS.length]}40`,
                      color: AVATAR_COLORS[index % AVATAR_COLORS.length],
                    }}
                  >
                    {(c.uname || c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="gp-comment-body">
                    <div className="gp-comment-header">
                      <span className="gp-comment-author">{c.uname || c.name}</span>
                      <span className="gp-comment-date">{c.postdate || c.date}</span>
                    </div>
                    <p className="gp-comment-text">{c.ncom || c.text}</p>
                    <button
                      className="gp-del-btn"
                      onClick={() => deleteComment(c._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
