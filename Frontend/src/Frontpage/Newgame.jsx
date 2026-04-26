import React from 'react'


export default function Newgame() {
  const TAGS = ['FPS', 'Survival', 'Open World', 'Dinosaurs', 'Repack']

  return (
    <section className="spotlight-section">
      <div className="spotlight-bg-grid" />

      <div className="spotlight-inner">
        {/* Header */}
        <div className="section-header">
          <div className="section-eyebrow">
            <span className="eyebrow-icon">🦕</span>
            <span>Featured Release</span>
          </div>
          <h2 className="section-title">
            Spotlight <span className="title-accent">Game</span>
          </h2>
        </div>

        {/* Content layout */}
        <div className="spotlight-layout">
          {/* Image side */}
          <div className="spotlight-img-wrap">
            <img
              src="https://m.media-amazon.com/images/M/MV5BZmNiYTg3NTktYmI0NC00ZDA2LWI1YjktYTk3NjM1Y2QxN2U2XkEyXkFqcGc@._V1_.jpg"
              alt="FEROCIOUS"
              className="spotlight-img"
            />
            <div className="spotlight-img-glow" />
            <div className="spotlight-img-badge">New Release</div>
          </div>

          {/* Text side */}
          <div className="spotlight-text">
            <div className="spotlight-genre-row">
              {TAGS.map((tag) => (
                <span key={tag} className="spotlight-tag">{tag}</span>
              ))}
            </div>

            <h3 className="spotlight-title">FEROCIOUS</h3>

            <div className="spotlight-divider" />

            <p className="spotlight-desc">
              A first-person survival shooter that drops you into a brutal, untamed island where
              modern weapons collide with prehistoric predators. You're stranded, outmatched,
              and constantly hunted.
            </p>

            <p className="spotlight-desc">
              Gameplay blends FPS combat, survival mechanics, and light exploration. Scavenge for
              weapons and ammo while navigating dense jungles and abandoned military facilities.
              Dinosaurs are roaming threats with unpredictable behavior — think tactically or die.
            </p>

            {/* Meta info */}
            <div className="spotlight-meta-grid">
              {[
                { label: 'Genre', val: 'FPS / Survival' },
                { label: 'Status', val: 'Repacked' },
                { label: 'Price', val: 'Free' },
                { label: 'Safety', val: 'Virus-free' },
              ].map((m) => (
                <div key={m.label} className="spotlight-meta-item">
                  <span className="spotlight-meta-label">{m.label}</span>
                  <span className="spotlight-meta-val">{m.val}</span>
                </div>
              ))}
            </div>

           
          </div>
        </div>
      </div>
    </section>
  )
}
