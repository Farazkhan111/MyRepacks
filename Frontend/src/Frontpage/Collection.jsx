import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import url from './url'

/* ── Extract YouTube video ID from any YT URL format ── */
function getYouTubeId(ytUrl) {
  if (!ytUrl) return null
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ]
  for (const re of patterns) {
    const m = ytUrl.match(re)
    if (m) return m[1]
  }
  return null
}

/* ── Individual card with YouTube preview on hover ── */
function GameCard({ game, index, onClick }) {
  const iframeRef  = useRef(null)
  const hoverTimer = useRef(null)
  const [hovered,     setHovered]     = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const videoId = getYouTubeId(game.video)

  /* YT embed: autoplay, muted, looped, no controls/branding */
  const ytSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1`
    : null

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(() => setHovered(true), 150)
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current)
    setHovered(false)
    setIframeReady(false)
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
    )
  }

  useEffect(() => {
    if (!iframeRef.current) return
    iframeRef.current.src = hovered && ytSrc ? ytSrc : ''
  }, [hovered, ytSrc])

  return (
    <div
      className="col-card"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ animationDelay: `${(index % 12) * 0.04}s` }}
    >
      <div className="col-card-img-wrap">

        <img
          src={game.fimage}
          alt={game.name}
          className="col-card-img"
          style={{
            opacity: hovered && videoId && iframeReady ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />

        {videoId && (
          <iframe
            ref={iframeRef}
            src=""
            className="col-card-yt-iframe"
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            title={game.name}
            onLoad={() => {
              if (hovered) setTimeout(() => setIframeReady(true), 800)
            }}
            style={{
              opacity: iframeReady ? 1 : 0,
              transition: 'opacity 0.4s ease',
              pointerEvents: 'none',
            }}
          />
        )}

        <div className="col-card-overlay" />

        {game.category && <span className="col-card-cat">{game.category}</span>}

        {hovered && videoId && !iframeReady && (
          <div className="col-card-play" style={{ opacity: 1 }}>
            <div className="col-card-spinner" />
          </div>
        )}

        {!videoId && (
          <div className="col-card-play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}

        {hovered && videoId && iframeReady && (
          <div className="col-card-video-badge">
            <span className="col-card-video-dot" />
            PREVIEW
          </div>
        )}
      </div>

      <div className="col-card-info">
        <h4 className="col-card-name">{game.name}</h4>
        <div className="col-card-footer">
          <span className="col-card-free">Free Download</span>
          <svg className="col-card-arrow" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/* ── Main Collection page ── */
export default function Collection() {
  const [allgames,  setGames]    = useState([])
  const [platform,  setPlatform] = useState('PC')
  const [category,  setCategory] = useState('All')
  const [loading,   setLoading]  = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    axios.get(url + '/collection').then((res) => {
      setGames(res.data)
      setLoading(false)
    })
  }, [])

  function switchPlatform(p) {
    setPlatform(p)
    setCategory('All')
  }

  const platformGames = allgames.filter(g =>
    platform === 'Mobile' ? g.platform === 'Mobile' : (!g.platform || g.platform === 'PC')
  )

  const filtered = platformGames.filter(g =>
    category === 'All' || g.category === category
  )

  /* ── Derive categories dynamically from the fetched games ── */
  const cats = [
    'All',
    ...Array.from(
      new Set(
        platformGames
          .map(g => g.category)
          .filter(Boolean)          // drop null / undefined / ''
      )
    ).sort(),
  ]

  const pcCount     = allgames.filter(g => !g.platform || g.platform === 'PC').length
  const mobileCount = allgames.filter(g => g.platform === 'Mobile').length

  return (
    <div className="collection-page">

      <div className="collection-header">
        <div className="collection-header-bg" />
        <div className="collection-header-content">
          <div className="section-eyebrow">
            <span className="eyebrow-icon">🎮</span>
            <span>Full Library</span>
          </div>
          <h1 className="collection-title">
            Game <span className="title-accent">Library</span>
          </h1>
          <p className="collection-subtitle">
            {loading ? 'Loading...' : `${filtered.length} games available — all free`}
          </p>
        </div>
      </div>

      <div className="platform-toggle-bar">
        <button
          className={`platform-toggle-btn ${platform === 'PC' ? 'active' : ''}`}
          onClick={() => switchPlatform('PC')}
        >
          💻 PC Games
          <span className="platform-count">{pcCount}</span>
        </button>
        <button
          className={`platform-toggle-btn ${platform === 'Mobile' ? 'active' : ''}`}
          onClick={() => switchPlatform('Mobile')}
        >
          📱 Mobile Games
          <span className="platform-count">{mobileCount}</span>
        </button>
      </div>

      <div className="collection-filter-bar">
        <div className="collection-filter-inner">
          {cats.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'All' ? (platform === 'Mobile' ? 'All Mobile' : 'All PC') : cat}
              {category === cat && <span className="filter-btn-dot" />}
            </button>
          ))}
        </div>
      </div>

      <div className="collection-body">
        {loading ? (
          <div className="collection-loading">
            <div className="loading-spinner" />
            <span>Loading Games...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="collection-empty">
            <span>{platform === 'Mobile' ? '📱' : '💻'}</span>
            <p>No {platform} games in this category yet.</p>
          </div>
        ) : (
          <div className="collection-grid">
            {filtered.map((game, index) => (
              <GameCard
                key={game._id || index}
                game={game}
                index={index}
                onClick={() => nav('/gamepage', { state: game._id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}