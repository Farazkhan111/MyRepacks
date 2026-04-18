import React from 'react'

const FEATURES = [
  {
    icon: '⚡',
    title: 'Fast Downloads',
    desc: 'High-speed servers deliver your games quickly, no waiting around.',
    color: '#ffb000',
  },
  {
    icon: '📦',
    title: 'Repacked Games',
    desc: 'Intelligently compressed files — smaller size, zero quality loss.',
    color: '#4cc9f0',
  },
  {
    icon: '🛡️',
    title: 'Safe & Clean',
    desc: 'Every single repack is virus-scanned and manually tested.',
    color: '#06d6a0',
  },
  {
    icon: '🔓',
    title: 'Completely Free',
    desc: 'No paywalls, no subscriptions, no tricks. Free forever.',
    color: '#a855f7',
  },
]

const STATS = [
  { val: '500+', label: 'Games' },
  { val: '0', label: 'Ads' },
  { val: '100%', label: 'Free' },
  { val: '24/7', label: 'Available' },
]

export default function Aboutp() {
  return (
    <div className="about-page">
      {/* Background */}
      <div className="about-bg-glow" />

      <div className="about-inner">
        {/* Hero text */}
        <div className="about-hero">
          <div className="section-eyebrow">
            <span className="eyebrow-icon">🎮</span>
            <span>Our Story</span>
          </div>
          <h1 className="about-title">
            About <span className="title-accent">MyRePacks</span>
          </h1>
          <p className="about-tagline">
            Your go-to destination for free, compressed game downloads.
          </p>
        </div>

        {/* Stats strip */}
        <div className="about-stats-strip">
          {STATS.map((s, i) => (
            <React.Fragment key={s.label}>
              <div className="about-stat">
                <span className="about-stat-val">{s.val}</span>
                <span className="about-stat-label">{s.label}</span>
              </div>
              {i < STATS.length - 1 && <div className="about-stat-divider" />}
            </React.Fragment>
          ))}
        </div>

        {/* Mission card */}
        <div className="about-mission-card">
          <div className="about-mission-label">Our Mission</div>
          <p className="about-mission-text">
            MyRePacks takes the best PC games and repacks them into smaller, faster-to-download
            files without sacrificing any gameplay quality. We believe great games should be
            accessible to everyone — no ads, no tricks, no paywalls. Just games, done right.
          </p>
        </div>

        {/* Features grid */}
        <div className="about-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="about-feature-card">
              <div
                className="about-feature-icon"
                style={{
                  background: f.color + '14',
                  border: `1px solid ${f.color}30`,
                }}
              >
                <span>{f.icon}</span>
              </div>
              <div className="about-feature-content">
                <h3
                  className="about-feature-title"
                  style={{ color: f.color }}
                >
                  {f.title}
                </h3>
                <p className="about-feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="about-footer-note">
          <div className="about-footer-line" />
          <p>Built with ❤️ for gamers, by gamers.</p>
          <div className="about-footer-line" />
        </div>
      </div>
    </div>
  )
}
