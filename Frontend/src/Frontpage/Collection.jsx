import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import url from './url'
import { useTilt, Reveal } from './ScrollFx'

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

/* ── Lazy-load the official YouTube IFrame Player API exactly once ──
   We need the real Player object (not just a plain <iframe src=...>)
   because "start playback from the middle of the video" requires
   reading the real duration once metadata loads, then seeking to it.
   A static ?start=N URL param can't do that — N would have to be a
   guess, and would be wrong for every video of a different length. */
let ytApiPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady()
      resolve(window.YT)
    }
    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script')
      tag.id  = 'yt-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
  return ytApiPromise
}

/* ── Individual card with a chrome-free YouTube preview on hover ── */
function GameCard({ game, index, onClick }) {
  // wrapperRef is React-owned and stays empty in JSX forever — the actual
  // mount node handed to YT.Player is created imperatively below and lives
  // *inside* this wrapper. That keeps the YouTube API's DOM replacement
  // (it swaps the mount node for its own <iframe>) completely outside
  // React's virtual DOM, so React never tries to touch/remove a node the
  // API has already replaced (which would otherwise throw on unmount).
  const wrapperRef = useRef(null)
  const playerRef   = useRef(null)
  const hoverTimer  = useRef(null)
  const tiltRef     = useTilt()
  const [hovered,     setHovered]     = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const videoId = getYouTubeId(game.video)

  /* Jump to the midpoint and play — used on first load AND every time
     the clip loops, so the preview only ever shows the "good part",
     never the cold-open / studio logo at 0:00. */
  function seekToMiddleAndPlay(player) {
    try {
      const duration = player.getDuration() || 0
      if (duration > 6) player.seekTo(duration / 2, true)
      player.mute() // ensure muted (required for guaranteed autoplay)
      player.playVideo()
    } catch (_) {}
  }

  function stripChrome(player) {
    const iframe = player.getIframe?.()
    if (!iframe) return
    iframe.style.width  = '100%'
    iframe.style.height = '100%'
    iframe.setAttribute('tabindex', '-1')
    iframe.removeAttribute('allowfullscreen')   // no fullscreen control, even via keyboard/API
    iframe.setAttribute('allow', 'autoplay; encrypted-media')
    iframe.title = `${game.name} preview`
  }

  function createPlayer() {
    loadYouTubeAPI().then((YT) => {
      if (!wrapperRef.current || playerRef.current) return
      const mountEl = document.createElement('div')
      wrapperRef.current.appendChild(mountEl)
      playerRef.current = new YT.Player(mountEl, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,        // no play/pause/seek/fullscreen bar
          fs: 0,               // no fullscreen button
          disablekb: 1,        // no keyboard-triggered controls
          modestbranding: 1,   // smallest possible YouTube logo
          rel: 0,
          iv_load_policy: 3,   // no annotations
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            stripChrome(e.target)
            seekToMiddleAndPlay(e.target)
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) setPlayerReady(true)
            if (e.data === YT.PlayerState.ENDED)    seekToMiddleAndPlay(e.target) // loop from the middle, not from 0
          },
        },
      })
    })
  }

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(() => {
      setHovered(true)
      if (!videoId) return
      if (!playerRef.current) createPlayer()
      else seekToMiddleAndPlay(playerRef.current)
    }, 150)
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current)
    setHovered(false)
    setPlayerReady(false)
    try { playerRef.current?.pauseVideo?.() } catch (_) {}
  }

  useEffect(() => {
    return () => { try { playerRef.current?.destroy?.() } catch (_) {} }
  }, [])

  return (
    <div
      ref={tiltRef}
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
            opacity: hovered && videoId && playerReady ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />

        {videoId && (
          <>
            <div
              ref={wrapperRef}
              className="col-card-yt-iframe"
              style={{
                opacity: playerReady ? 1 : 0,
                transition: 'opacity 0.4s ease',
                pointerEvents: 'none', // mouse never reaches the player — no hover-triggered YouTube UI at all
              }}
            />
            {/* Mask any residual YouTube branding (logo / title card) that
                slips past the params above — purely cosmetic crop. */}
            {playerReady && (
              <>
                <div className="col-card-yt-mask col-card-yt-mask-top" />
                <div className="col-card-yt-mask col-card-yt-mask-corner" />
              </>
            )}
          </>
        )}

        <div className="col-card-overlay" />

        {game.category && <span className="col-card-cat">{game.category}</span>}

        {hovered && videoId && !playerReady && (
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

        {hovered && videoId && playerReady && (
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
  const [category,  setCategory] = useState('All')
  const [loading,   setLoading]  = useState(true)
  const nav = useNavigate()

  // ── Read platform from router state (set by Navbar links) ──
  const { state } = useLocation()
  const [platform, setPlatform] = useState(state?.platform || 'PC')

  useEffect(() => {
    axios.get(url + '/collection').then((res) => {
      setGames(res.data)
      setLoading(false)
    })
  }, [])

  // ── Sync platform if user navigates from navbar while already on this page ──
  useEffect(() => {
    if (state?.platform) {
      setPlatform(state.platform)
      setCategory('All')
    }
  }, [state])

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
          PC Games
          <span className="platform-count">{pcCount}</span>
        </button>
        <button
          className={`platform-toggle-btn ${platform === 'Mobile' ? 'active' : ''}`}
          onClick={() => switchPlatform('Mobile')}
        >
          Mobile Games
          <span className="platform-count">{mobileCount}</span>
        </button>
      </div>

      <div className="collection-filter-bar">
        <div className="collection-filter-inner">
          <select
            className="filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {cats.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? (platform === 'Mobile' ? 'All Mobile' : 'All PC') : cat}
              </option>
            ))}
          </select>
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
              <Reveal key={game._id || index} delay={(index % 12) * 30}>
                <GameCard
                  game={game}
                  index={index}
                  onClick={() => nav('/gamepage', { state: game._id })}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}