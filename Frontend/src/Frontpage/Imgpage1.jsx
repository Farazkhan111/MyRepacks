import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'


const TAGLINES = [
  { top: 'Browse Our', bottom: 'Popular Games' },
  { top: 'Play Without', bottom: 'Limits' },
  { top: 'Free Repacked', bottom: 'Downloads' },
]

const STATS = [
  { val: '500+', label: 'Games' },
  { val: '100%', label: 'Free' },
  { val: 'Fast', label: 'Servers' },
  { val: 'Safe', label: 'Repacks' },
]

export default function Imgpage1() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % TAGLINES.length)
        setVisible(true)
      }, 400)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="hero-section">
      {/* Background layers */}
      <div className="hero-bg-grid" />
      <div className="hero-bg-glow hero-glow-1" />
      <div className="hero-bg-glow hero-glow-2" />
      <div className="hero-scanlines" />

      <div className="hero-content">
        {/* Eyebrow */}
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          <span>Welcome to MyRePacks</span>
          <span className="hero-eyebrow-dot" />
        </div>

        {/* Animated headline */}
        <div
          className="hero-headline"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-12px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}
        >
          <span className="hero-headline-top">{TAGLINES[idx].top}</span>
          <br />
          <span className="hero-headline-bottom">{TAGLINES[idx].bottom}</span>
        </div>

        {/* Sub text */}
        <p className="hero-subtext">
          Discover top repacked games with fast downloads and best performance.
          <br className="hero-br-hide" />
          No ads, no nonsense — just games.
        </p>

        {/* CTA buttons */}
        <div className="hero-cta-row">
          <Link to="/collection" className="hero-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Browse Now
          </Link>
          <Link to="/about" className="hero-btn-secondary">
            Learn More
          </Link>
        </div>

        {/* Stats row */}
        <div className="hero-stats">
          {STATS.map((s) => (
            <div key={s.label} className="hero-stat">
              <span className="hero-stat-val">{s.val}</span>
              <span className="hero-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero-scroll-hint">
        <span className="hero-scroll-label">Scroll</span>
        <span className="hero-scroll-line" />
      </div>
    </section>
  )
}
