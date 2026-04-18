import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import url from './url'

export default function Popularp() {
  const [tgame, setData] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    axios.post(url + '/showtrend').then((res) => setData(res.data))
  }, [])

  const trending = tgame.filter((g) => g.trending === 'Trending')

  return (
    <section className="trending-section">
      {/* Section header */}
      <div className="section-header">
        <div className="section-eyebrow">
          <span className="eyebrow-icon">🔥</span>
          <span>Hot Right Now</span>
        </div>
        <h2 className="section-title">
          Trending <span className="title-accent">Games</span>
        </h2>
        <p className="section-subtitle">Most downloaded games this week</p>
      </div>

      {/* Grid */}
      <div className="trending-grid">
        {trending.map((game, index) => (
          <div
            key={game._id || index}
            className="game-card"
            onClick={() => nav('/gamepage', { state: game._id })}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            {/* Image */}
            <div className="game-card-img-wrap">
              <img
                src={game.fimage}
                alt={game.name}
                className="game-card-img"
              />
              <div className="game-card-overlay" />

              {/* Badges */}
              <div className="game-card-badge-row">
                <span className="badge-fire">🔥 Trending</span>
                {index < 3 && (
                  <span className="badge-rank">#{index + 1}</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="game-card-info">
              <h3 className="game-card-title">{game.name}</h3>
              <div className="game-card-meta">
                {game.category && (
                  <span className="game-card-cat">{game.category}</span>
                )}
                <span className="game-card-free">Free</span>
              </div>
              <div className="game-card-bar" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
