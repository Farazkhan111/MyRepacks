import axios from 'axios'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import url from './url'


const CATEGORIES = ['AllGames', 'Roleplay', 'Simulation', 'Sports']

export default function Collection() {
  const [allgames, setGames] = useState([])
  const [selecvalue, setSval] = useState('AllGames')
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    axios.get(url + '/collection').then((res) => {
      setGames(res.data)
      setLoading(false)
    })
  }, [])

  function showgame(id) {
    nav('/gamepage', { state: id })
  }

  const filtered = allgames.filter(
    (g) => selecvalue === 'AllGames' || selecvalue === g.category
  )

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

      {/* Filter bar */}
      <div className="collection-filter-bar">
        <div className="collection-filter-inner">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${selecvalue === cat ? 'active' : ''}`}
              onClick={() => setSval(cat)}
            >
              {cat === 'AllGames' ? 'All Games' : cat}
              {selecvalue === cat && (
                <span className="filter-btn-dot" />
              )}
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
        ) : (
          <div className="collection-grid">
            {filtered.map((game, index) => (
              <div
                key={game._id || index}
                className="col-card"
                onClick={() => showgame(game._id)}
                style={{ animationDelay: `${(index % 12) * 0.04}s` }}
              >
                <div className="col-card-img-wrap">
                  <img
                    src={game.fimage}
                    alt={game.name}
                    className="col-card-img"
                  />
                  <div className="col-card-overlay" />
                  {game.category && (
                    <span className="col-card-cat">{game.category}</span>
                  )}
                  {/* Hover play icon */}
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
                    <svg className="col-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
