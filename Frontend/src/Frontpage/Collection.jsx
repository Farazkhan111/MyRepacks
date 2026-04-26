import axios from 'axios'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import url from './url'

const PC_CATEGORIES     = ['All', 'Roleplay', 'Simulation', 'Sports', 'Action', 'Strategy', 'Adventure']
const MOBILE_CATEGORIES = ['All', 'Action', 'Casual', 'Puzzle', 'Racing', 'RPG', 'Sports', 'Strategy','Simulation']

export default function Collection() {
  const [allgames,  setGames]   = useState([])
  const [platform,  setPlatform]= useState('PC')      // 'PC' | 'Mobile'
  const [category,  setCategory]= useState('All')
  const [loading,   setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    axios.get(url + '/collection').then((res) => {
      setGames(res.data)
      setLoading(false)
    })
  }, [])

  // Reset category when switching platform
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

  const cats = platform === 'Mobile' ? MOBILE_CATEGORIES : PC_CATEGORIES

  const pcCount     = allgames.filter(g => !g.platform || g.platform === 'PC').length
  const mobileCount = allgames.filter(g => g.platform === 'Mobile').length

  return (
    <div className="collection-page">

      {/* Page header */}
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

      {/* ── Platform toggle ── */}
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

      {/* Category filter bar */}
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

      {/* Games grid */}
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
              <div
                key={game._id || index}
                className="col-card"
                onClick={() => nav('/gamepage', { state: game._id })}
                style={{ animationDelay: `${(index % 12) * 0.04}s` }}
              >
                <div className="col-card-img-wrap">
                  <img src={game.fimage} alt={game.name} className="col-card-img" />
                  <div className="col-card-overlay" />

                  {/* Platform badge
                  <span className={`col-card-platform ${game.platform === 'Mobile' ? 'mobile' : 'pc'}`}>
                    {game.platform === 'Mobile' ? '📱' : '💻'}
                  </span> */}

                  {game.category && <span className="col-card-cat">{game.category}</span>}
                  <div className="col-card-play">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
