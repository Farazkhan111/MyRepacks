import axios from 'axios'
import { useEffect, useRef, useState, useCallback } from 'react'
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

// ── Dominant colour extractor via canvas ─────────────────────────
function extractDominantColor(imgEl) {
  try {
    const canvas = document.createElement('canvas')
    const SIZE = 80
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgEl, 0, 0, SIZE, SIZE)
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data
    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 16) {
      const pr = data[i], pg = data[i+1], pb = data[i+2]
      // skip near-black / near-white
      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb
      if (lum < 20 || lum > 235) continue
      r += pr; g += pg; b += pb; count++
    }
    if (!count) return null
    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)
    // boost saturation
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat < 0.25) return null          // too grey — fallback
    return { r, g, b }
  } catch (_) {
    return null
  }
}

// ── Derive a palette from a single colour ─────────────────────────
function buildPalette(col) {
  if (!col) return null
  const { r, g, b } = col
  const toHex = (rv, gv, bv) =>
    '#' + [rv, gv, bv].map(x => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2,'0')).join('')
  // neon = fully-saturated vivid version
  const max = Math.max(r, g, b)
  const scale = max > 0 ? 255 / max : 1
  const neon   = toHex(r * scale, g * scale, b * scale)
  // complementary (rotate hue ~180°)
  const comp   = toHex(255 - r * 0.5, 255 - g * 0.5, 255 - b * 0.5)
  // muted glow
  const glow   = `rgba(${r},${g},${b},0.55)`
  const glowSm = `rgba(${r},${g},${b},0.25)`
  const glowXs = `rgba(${r},${g},${b},0.12)`
  return { neon, comp, glow, glowSm, glowXs, r, g, b }
}

export default function Gamepage() {
  const [game,        setGame]       = useState({})
  const [com,         setComments]   = useState([])
  const [name,        setName]       = useState('')
  const [text,        setText]       = useState('')
  const [submitted,   setSubmitted]  = useState(false)
  const [lightboxIdx, setLightboxIdx]= useState(null)
  const [palette,     setPalette]    = useState(null)

  const heroRef    = useRef(null)
  const thumbRef   = useRef(null)
  const iframeRef  = useRef(null)

  const loc = useLocation()
  const idd = loc.state

  useEffect(() => {
    axios.post(url + '/gamepage',  { idd }).then((res) => setGame(res.data))
    axios.post(url + '/comments',  { idd }).then((res) => setComments(res.data))
  }, [idd])

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Reset trailer/palette when game changes
  useEffect(() => {
    setPalette(null)
  }, [game._id])

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

  // ── Colour extraction from cover image ───────────────────────────
  const handleCoverLoad = useCallback((e) => {
    const col = extractDominantColor(e.target)
    if (col) setPalette(buildPalette(col))
  }, [])

  // Apply dynamic CSS variables to the page root
  useEffect(() => {
    if (!palette) return
    const el = document.documentElement
    el.style.setProperty('--gp-neon',    palette.neon)
    el.style.setProperty('--gp-comp',    palette.comp)
    el.style.setProperty('--gp-glow',    palette.glow)
    el.style.setProperty('--gp-glow-sm', palette.glowSm)
    el.style.setProperty('--gp-glow-xs', palette.glowXs)
    return () => {
      el.style.removeProperty('--gp-neon')
      el.style.removeProperty('--gp-comp')
      el.style.removeProperty('--gp-glow')
      el.style.removeProperty('--gp-glow-sm')
      el.style.removeProperty('--gp-glow-xs')
    }
  }, [palette])

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

  // Dynamic neon colours for inline styles (fallback to default cyan)
  const neon   = palette?.neon    || 'var(--neon-cyan)'
  const glow   = palette?.glow    || 'rgba(0,229,255,0.55)'
  const glowSm = palette?.glowSm  || 'rgba(0,229,255,0.25)'
  const glowXs = palette?.glowXs  || 'rgba(0,229,255,0.12)'
  const r      = palette?.r       ?? 0
  const g      = palette?.g       ?? 229
  const b2     = palette?.b       ?? 255

  return (
    <div className="gp-page" style={palette ? {
      '--gp-neon': neon, '--gp-glow': glow, '--gp-glow-sm': glowSm, '--gp-glow-xs': glowXs,
    } : {}}>

      {/* ── Ambient colour orbs behind everything ── */}
      {palette && (
        <div className="gp-ambient" aria-hidden="true">
          <div className="gp-orb gp-orb-1" style={{ background: `rgba(${r},${g},${b2},0.18)` }} />
          <div className="gp-orb gp-orb-2" style={{ background: `rgba(${r},${g},${b2},0.10)` }} />
        </div>
      )}

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

        {/*
          Dynamic neon bottom glow strip.
          IMPORTANT: both gradient ends are transparent (0% and 100%),
          with the accent colour only appearing mid-strip. The old
          version started the colour AT 0% (the exact hero/page
          boundary), which meant every game's extracted cover colour
          painted a visible tinted line right at the seam — vivid
          covers showed it clearly, muted covers didn't. Keeping both
          edges transparent means no colour ever touches that
          boundary pixel, for any game, regardless of how saturated
          its cover art is.
        */}
        {palette && (
          <div className="gp-hero-glow-strip"
            style={{ background: `linear-gradient(to top, transparent 0%, ${glowSm} 45%, transparent 100%)` }} />
        )}
      </div>

      {/* Main content */}
      <div className="gp-main">
        <div className="gp-identity-row">
          {/* Cover — used for colour extraction */}
          <img
            ref={thumbRef}
            src={game.image}
            alt={game.name}
            className="gp-cover-img"
            crossOrigin="anonymous"
            onLoad={handleCoverLoad}
            style={palette ? {
              borderColor: `${neon}55`,
              boxShadow:   `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${glowSm}`,
            } : {}}
          />
          <div className="gp-title-block">
            {game.category && (
              <span className="gp-category-tag" style={palette ? {
                color:      neon,
                background: glowXs,
                borderColor:`${neon}40`,
              } : {}}>
                {game.category}
              </span>
            )}
            <h1 className="gp-game-title" style={palette ? {
              textShadow: `0 0 40px ${glowSm}`,
            } : {}}>
              {game.name}
            </h1>
            <p className="gp-game-sub">
              {isMobile ? 'Android APK · Free · Safe' : 'Free Download · Compressed · Virus-free'}
            </p>

            <div className="gp-meta-row">
              <span className="gp-meta-chip gp-chip-green">✓ Safe</span>
              <span className="gp-meta-chip gp-chip-amber" style={palette ? {
                color: neon, background: glowXs, borderColor: `${neon}40`,
              } : {}}>
                {isMobile ? 'APK' : 'Repack'}
              </span>
              <span className="gp-meta-chip gp-chip-blue">Free</span>
            </div>
          </div>
        </div>

        {/* Dynamic divider */}
        <div className="gp-divider" style={palette ? {
          background: `linear-gradient(90deg, ${glow}, ${glowXs}, transparent)`,
        } : {}} />

        {game.description && (
          <div className="gp-desc-block" style={palette ? {
            borderColor: `${neon}22`,
            boxShadow:   `0 0 30px ${glowXs} inset`,
          } : {}}>
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
                  style={palette ? { '--thumb-hover-border': `${neon}66` } : {}}
                >
                  <img src={shot.url} alt={`${game.name} screenshot ${i + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="gp-dl-btn" onClick={down} style={palette ? {
          background:  `linear-gradient(135deg, rgba(${r},${g},${b2},0.9), rgba(${r},${g},${b2},0.6))`,
          boxShadow:   `0 0 40px ${glowSm}`,
          color:       '#fff',
        } : {}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          {dlBtnLabel}
        </button>
        <p className="gp-dl-note">{dlNote}</p>

        <div className="gp-divider" style={palette ? {
          background: `linear-gradient(90deg, ${glow}, ${glowXs}, transparent)`,
        } : {}} />

        {/* Comments */}
        <div className="gp-comments-block" style={palette ? {
          borderColor: `${neon}22`,
        } : {}}>
          <h2 className="gp-block-title">
            Comments
            {com.length > 0 && (
              <span className="gp-comment-count" style={palette ? {
                color: neon, background: glowXs, borderColor: `${neon}40`,
              } : {}}>
                {com.length}
              </span>
            )}
          </h2>

          <div className="gp-form">
            <input className="gp-input" type="text" placeholder="Your name"
              value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="gp-textarea" placeholder="Share your thoughts..."
              value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            <button className={`gp-post-btn ${submitted ? 'submitted' : ''}`} onClick={handleSubmit}
              style={palette && !submitted ? {
                color:       neon,
                background:  glowXs,
                borderColor: `${neon}50`,
              } : {}}>
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
            style={palette ? { borderColor: `${neon}44` } : {}}
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