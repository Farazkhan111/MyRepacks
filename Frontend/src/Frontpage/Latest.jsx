import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import url from './url'

export default function Latest() {
  const [lgame, setData] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    axios.post(url + '/showtrend').then((res) => setData(res.data.reverse()))
  }, [])

  function showgame(id) {
    nav('/gamepage', { state: id })
  }

  const games = lgame.slice(0, 12)

  return (
    <section className="latest-section">
      {/* Background accent */}
      <div className="latest-bg-accent" />

      <div className="latest-inner">
        {/* Section header */}
        <div className="section-header">
          <div className="section-eyebrow">
            <span className="eyebrow-icon">⚡</span>
            <span>Just Added</span>
          </div>
          <h2 className="section-title">
            Latest <span className="title-accent">Releases</span>
          </h2>
          <p className="section-subtitle">Fresh repacks added to the library</p>
        </div>

        {/* List layout */}
        <div className="latest-list">
          {games.map((game, index) => (
            <div
              key={game._id || index}
              className="latest-item"
              onClick={() => showgame(game._id)}
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              {/* Index number */}
              <span className="latest-item-num">
                {String(index + 1).padStart(2, '0')}
              </span>

              {/* Thumbnail */}
              <div className="latest-item-thumb">
                <img src={game.image} alt={game.name} />
              </div>

              {/* Info */}
              <div className="latest-item-info">
                <h4 className="latest-item-name">{game.name}</h4>
                {game.category && (
                  <span className="latest-item-cat">{game.category}</span>
                )}
              </div>

              {/* Tags */}
              <div className="latest-item-right">
                <span className="latest-badge-new">New</span>
                <svg
                  className="latest-item-arrow"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
