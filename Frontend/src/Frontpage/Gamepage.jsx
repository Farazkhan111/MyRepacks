import axios from 'axios'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import url from './url'

const AVATAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5',
  '#f72585', '#4cc9f0', '#fb8500', '#06d6a0', '#ef233c',
]

export default function Gamepage() {
  const [game,      setGame]    = useState({})
  const [com,       setComments]= useState([])
  const [name,      setName]    = useState('')
  const [text,      setText]    = useState('')
  const [submitted, setSubmitted]=useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(null)

  const loc = useLocation()
  const idd = loc.state
  // const nav = useNavigate()

  useEffect(() => {
    axios.post(url + '/gamepage',  { idd }).then((res) => setGame(res.data))
    axios.post(url + '/comments',  { idd }).then((res) => setComments(res.data))
  }, [idd])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  function down() { window.open(game.link, '_blank') }

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

  const isMobile   = game.platform === 'Mobile'
  const dlBtnLabel = isMobile ? 'Download APK — Free' : 'Download Now — Free'
  const dlNote     = isMobile
    ? '🔒 Safe APK · No registration · Install on Android'
    : '🔒 Virus-free · Fully repacked · No registration needed'

  // Some repack sites (FitGirl, etc.) embed a small "torrent health"
  // widget image (seeds/peers/file count, e.g. torrent-stats.info /
  // [kitty-kode]) inside the post alongside real screenshots. Guard
  // against ever rendering one here, even if it slipped into the DB
  // before the scraper started filtering these out.
  const isJunkShot = (img) => {
    const url = (img.url || '').toLowerCase()
    if (url.includes('torrent-stats') || url.includes('torrentstats') ||
        url.includes('kitty-kode')    || url.includes('kittykode')) return true
    const caption = (img.alt || img.title || '').toLowerCase()
    return /\bseeds?\s*:\s*\d+/.test(caption)
  }

  const screenshots = Array.isArray(game.images)
    ? game.images.filter((img) => img.type === 'screenshot' && img.url && !isJunkShot(img))
    : []

  return (
    <div className="gp-page">
      {/* Hero banner */}
      <div className="gp-hero">
        <div className="gp-hero-bg" style={{ backgroundImage: `url(${game.fimage})` }} />
        <div className="gp-hero-overlay" />
        <div className="gp-hero-scanlines" />
      </div>

      {/* Main content */}
      <div className="gp-main">
        <div className="gp-identity-row">
          <img src={game.image} alt={game.name} className="gp-cover-img" />
          <div className="gp-title-block">

            {/* Platform badge */}
            {/* {game.platform && (
              <span className={`gp-platform-tag ${isMobile ? 'gp-platform-mobile' : 'gp-platform-pc'}`}>
                {isMobile ? '📱 Mobile' : '💻 PC'}
              </span>
            )} */}

            {game.category && <span className="gp-category-tag">{game.category}</span>}
            <h1 className="gp-game-title">{game.name}</h1>
            <p className="gp-game-sub">
              {isMobile ? 'Android APK · Free · Safe' : 'Free Download · Compressed · Virus-free'}
            </p>

            <div className="gp-meta-row">
              <span className="gp-meta-chip gp-chip-green">✓ Safe</span>
              <span className="gp-meta-chip gp-chip-amber">{isMobile ? 'APK' : 'Repack'}</span>
              <span className="gp-meta-chip gp-chip-blue">Free</span>
            </div>
          </div>
        </div>

        <div className="gp-divider" />

        {game.description && (
          <div className="gp-desc-block">
            <h2 className="gp-block-title">About</h2>
            <p className="gp-description">{game.description}</p>
          </div>
        )}

        {screenshots.length > 0 && (
          <div className="gp-shots-block">
            <h2 className="gp-block-title">Screenshots</h2>
            <div className="gp-shots-grid">
              {screenshots.map((shot, i) => (
                <button
                  key={shot.url || i}
                  className="gp-shot-thumb"
                  onClick={() => setLightboxIdx(i)}
                  aria-label={`View screenshot ${i + 1}`}
                >
                  <img src={shot.url} alt={`${game.name} screenshot ${i + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="gp-dl-btn" onClick={down}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          {dlBtnLabel}
        </button>
        <p className="gp-dl-note">{dlNote}</p>

        <div className="gp-divider" />

        {/* Comments */}
        <div className="gp-comments-block">
          <h2 className="gp-block-title">
            Comments
            {com.length > 0 && <span className="gp-comment-count">{com.length}</span>}
          </h2>

          <div className="gp-form">
            <input className="gp-input" type="text" placeholder="Your name"
              value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="gp-textarea" placeholder="Share your thoughts..."
              value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            <button className={`gp-post-btn ${submitted ? 'submitted' : ''}`} onClick={handleSubmit}>
              {submitted ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Posted!
                </>
              ) : 'Post Comment'}
            </button>
          </div>

          <div className="gp-comment-list">
            {com.length === 0 ? (
              <div className="gp-no-comments">
                <span>No comments yet.</span>
                <span className="gp-no-comments-sub">Be the first to share your thoughts!</span>
              </div>
            ) : (
              com.map((c, index) => (
                <div key={c._id || index} className="gp-comment">
                  <div className="gp-avatar" style={{
                    background: AVATAR_COLORS[index % AVATAR_COLORS.length] + '18',
                    border:     `1px solid ${AVATAR_COLORS[index % AVATAR_COLORS.length]}40`,
                    color:      AVATAR_COLORS[index % AVATAR_COLORS.length],
                  }}>
                    {(c.uname || c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="gp-comment-body">
                    <div className="gp-comment-header">
                      <span className="gp-comment-author">{c.uname || c.name}</span>
                      <span className="gp-comment-date">{c.postdate || c.date}</span>
                    </div>
                    <p className="gp-comment-text">{c.ncom || c.text}</p>
                    <button className="gp-del-btn" onClick={() => deleteComment(c._id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {lightboxIdx !== null && screenshots[lightboxIdx] && (
        <div className="gp-lightbox" onClick={() => setLightboxIdx(null)}>
          <button className="gp-lightbox-close" onClick={() => setLightboxIdx(null)} aria-label="Close">
            ✕
          </button>

          {screenshots.length > 1 && (
            <button
              className="gp-lightbox-nav gp-lightbox-prev"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + screenshots.length) % screenshots.length) }}
              aria-label="Previous screenshot"
            >
              ‹
            </button>
          )}

          <img
            className="gp-lightbox-img"
            src={screenshots[lightboxIdx].url}
            alt={`${game.name} screenshot ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
          />

          {screenshots.length > 1 && (
            <button
              className="gp-lightbox-nav gp-lightbox-next"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % screenshots.length) }}
              aria-label="Next screenshot"
            >
              ›
            </button>
          )}

          <div className="gp-lightbox-count">{lightboxIdx + 1} / {screenshots.length}</div>
        </div>
      )}
    </div>
  )
}
