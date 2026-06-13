import React, { useEffect, useState } from 'react'

export default function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const duration = 1400
    const id = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(id)
        setTimeout(() => {
          setHide(true)
          setTimeout(() => onDone?.(), 600)
        }, 200)
      }
    }, 30)
    return () => clearInterval(id)
  }, [onDone])

  return (
    <div className={`loading-screen ${hide ? 'loading-screen-hide' : ''}`}>
      <div className="loading-grid" />
      <div className="loading-glow loading-glow-1" />
      <div className="loading-glow loading-glow-2" />

      <div className="loading-content">
        <div className="loading-controller">
          <svg viewBox="0 0 64 64" width="84" height="84" fill="none">
            <path
              d="M16 24 C10 24 6 30 6 38 C6 46 10 52 16 52 C20 52 22 48 26 48 L38 48 C42 48 44 52 48 52 C54 52 58 46 58 38 C58 30 54 24 48 24 L40 24 L36 20 L28 20 L24 24 Z"
              stroke="url(#ctrlGrad)"
              strokeWidth="2"
              fill="rgba(139,92,246,0.08)"
            />
            <circle cx="18" cy="38" r="2.5" fill="#00E5FF" />
            <circle cx="18" cy="32" r="2.5" fill="#00E5FF" opacity="0.5" />
            <circle cx="14" cy="36" r="2.5" fill="#00E5FF" opacity="0.5" />
            <circle cx="22" cy="36" r="2.5" fill="#00E5FF" opacity="0.5" />
            <circle cx="46" cy="34" r="2.5" fill="#FF00FF" />
            <circle cx="52" cy="38" r="2.5" fill="#FF00FF" opacity="0.6" />
            <circle cx="46" cy="42" r="2.5" fill="#FF00FF" opacity="0.6" />
            <circle cx="40" cy="38" r="2.5" fill="#FF00FF" opacity="0.6" />
            <defs>
              <linearGradient id="ctrlGrad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#FF00FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="loading-title">
          My<span className="loading-title-accent">RePacks</span>
        </div>

        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
          <div className="loading-bar-glow" style={{ left: `${progress}%` }} />
        </div>

        <div className="loading-text">
          Loading Your Gaming Universe<span className="loading-dots">...</span>
        </div>
        <div className="loading-pct">{Math.floor(progress)}%</div>
      </div>
    </div>
  )
}
