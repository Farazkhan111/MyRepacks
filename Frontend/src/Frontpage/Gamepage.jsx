import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import url from './url'

const AVATAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5',
  '#f72585', '#4cc9f0', '#fb8500', '#06d6a0', '#ef233c',
]

// ── Extract YouTube video ID from various URL formats ─────────────
function extractYouTubeId(videoUrl) {
  if (!videoUrl) return null
  const patterns = [
    /youtu\.be\/([^?&\s]{11})/,
    /youtube\.com\/watch\?v=([^&\s]{11})/,
    /youtube\.com\/embed\/([^?&\s]{11})/,
    /youtube\.com\/v\/([^?&\s]{11})/,
  ]
  for (const re of patterns) {
    const m = videoUrl.match(re)
    if (m) return m[1]
  }
  return null
}

// NOTE: this page intentionally uses ONLY the site's default cyan/purple
// theme for every game — no per-cover colour extraction, no dynamic
// ambient orbs, no accent-tinted download button. That system existed
// before but was removed on request: it caused a visible seam/glow
// artifact between the hero and the page content for games with
// saturated cover art, and made the download button's colour jump
// around per-game in a way that read as inconsistent/broken rather
// than intentional. Every element below now relies purely on the
// static CSS classes in Style.css (.gp-category-tag, .gp-chip-amber,
// .gp-dl-btn, etc.), which already default to the same cyan/purple
// look seen across the rest of the site.

export default function Gamepage() {
  const [game,        setGame]       = useState({})
  const [com,         setComments]   = useState([])
  const [name,        setName]       = useState('')
  const [text,        setText]       = useState('')
  const [submitted,   setSubmitted]  = useState(false)
  const [lightboxIdx, setLightboxIdx]= useState(null)

  const heroRef    = useRef(null)
  const iframeRef  = useRef(null)

  const loc = useLocation()
  const idd = loc.state

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

  const ytId      = extractYouTubeId(game.video)
  const hasTrailer = !!ytId

  // Start trailer from midpoint (seek to 50% of a typical 2-minute trailer → 60s)
  // YouTube embed: start=45 gives a nice action-mid feel for most trailers
  const trailerSrc = ytId
    ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&start=45&enablejsapi=1&playsinline=1`
    : null

  const isMobile   = game.platform === 'Mobile'
  const dlBtnLabel = isMobile ? 'Download APK — Free' : 'Download Now — Free'
  const dlNote     = isMobile
    ? '🔒 Safe APK · No registration · Install on Android'
    : '🔒 Virus-free · Fully repacked · No registration needed'

  const isJunkShot = (img) => {
    const u = (img.url || '').toLowerCase()
    if (u.includes('torrent-stats') || u.includes('torrentstats') ||
        u.includes('kitty-kode')    || u.includes('kittykode')) return true
    const caption = (img.alt || img.title || '').toLowerCase()
    return /\bseeds?\s*:\s*\d+/.test(caption)
  }

  const screenshots = Array.isArray(game.images)
    ? game.images.filter((img) => img.type === 'screenshot' && img.url && !isJunkShot(img))
    : []

  return (
    <div className="gp-page">

      {/* ── Hero: trailer video OR blurred fimage ── */}
      <div className="gp-hero" ref={heroRef}>

        {/* Blurred fimage — only when NO trailer */}
        {!hasTrailer && (
          <div
            className="gp-hero-bg"
            style={{ backgroundImage: `url(${game.fimage || game.image})` }}
          />
        )}

        {/* YouTube trailer — replaces fimage entirely */}
        {hasTrailer && (
          <div className="gp-trailer-wrap gp-trailer-wrap--visible">
            <iframe
              ref={iframeRef}
              className="gp-trailer-iframe"
              src={trailerSrc}
              title="Game Trailer"
              allow="autoplay; encrypted-media"
              allowFullScreen={false}
            />
            {/* Blur + darken overlay on the video */}
            <div className="gp-trailer-blur-overlay" />
          </div>
        )}

        <div className="gp-hero-overlay" />
        <div className="gp-hero-scanlines" />
      </div>

      {/* Main content */}
      <div className="gp-main">
        <div className="gp-identity-row">
          {/* Cover — display only, no crossOrigin so it always loads
              regardless of the host's CORS headers. Falls back to
              fimage when image is missing or its URL is dead. */}
          <img
            src={game.image || game.fimage}
            alt={game.name}
            className="gp-cover-img"
            onError={(e) => {
              if (game.fimage && e.target.src !== game.fimage) e.target.src = game.fimage
            }}
          />
          <div className="gp-title-block">
            {game.category && (
              <span className="gp-category-tag">{game.category}</span>
            )}
            <h1 className="gp-game-title">{game.name}</h1>
            <p className="gp-game-sub">
              {isMobile ? 'Android APK · Free · Safe' : 'Free Download · Compressed · Virus-free'}
            </p>

            <div className="gp-meta-row">
              <span className="gp-meta-chip gp-chip-green">✓ Safe</span>
              <span className="gp-meta-chip gp-chip-amber">
                {isMobile ? 'APK' : 'Repack'}
              </span>
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
            {com.length > 0 && (
              <span className="gp-comment-count">{com.length}</span>
            )}
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

      {/* Lightbox */}
      {lightboxIdx !== null && screenshots[lightboxIdx] && (
        <div className="gp-lightbox" onClick={() => setLightboxIdx(null)}>
          <button className="gp-lightbox-close" onClick={() => setLightboxIdx(null)} aria-label="Close">✕</button>

          {screenshots.length > 1 && (
            <button
              className="gp-lightbox-nav gp-lightbox-prev"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + screenshots.length) % screenshots.length) }}
              aria-label="Previous screenshot"
            >‹</button>
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
            >›</button>
          )}

          <div className="gp-lightbox-count">{lightboxIdx + 1} / {screenshots.length}</div>
        </div>
      )}
    </div>
  )
}