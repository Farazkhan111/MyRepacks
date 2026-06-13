import React, { useEffect, useRef } from 'react'

const COLORS = ['#8B5CF6', '#00E5FF', '#FF00FF', '#00FFFF']

export default function CyberBackground() {
  const canvasRef = useRef(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let w, h, particles, streaks, raf

    const isLowEnd = window.innerWidth < 768 || navigator.hardwareConcurrency <= 4

    function resize() {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }

    function init() {
      resize()
      const count = isLowEnd ? 70 : 160
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        a: Math.random() * 0.6 + 0.2,
      }))

      const streakCount = isLowEnd ? 3 : 6
      streaks = Array.from({ length: streakCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        len: Math.random() * 150 + 80,
        speed: Math.random() * 1.5 + 0.5,
        angle: Math.random() * Math.PI * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        a: Math.random() * 0.3 + 0.1,
      }))
    }

    function drawGrid() {
      const spacing = 60
      const offsetX = (mouse.current.x / w - 0.5) * 20
      const offsetY = (mouse.current.y / h - 0.5) * 20
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.045)'
      ctx.lineWidth = 1
      for (let x = -spacing; x < w + spacing; x += spacing) {
        ctx.beginPath()
        ctx.moveTo(x + offsetX, 0)
        ctx.lineTo(x + offsetX, h)
        ctx.stroke()
      }
      for (let y = -spacing; y < h + spacing; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y + offsetY)
        ctx.lineTo(w, y + offsetY)
        ctx.stroke()
      }
    }

    function tick() {
      ctx.clearRect(0, 0, w, h)
      drawGrid()

      // particles
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.a
        ctx.shadowBlur = 8
        ctx.shadowColor = p.color
        ctx.fill()
      })
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // energy streaks
      streaks.forEach((s) => {
        const dx = Math.cos(s.angle) * s.len
        const dy = Math.sin(s.angle) * s.len
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + dx, s.y + dy)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.5, s.color)
        grad.addColorStop(1, 'transparent')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.globalAlpha = s.a
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x + dx, s.y + dy)
        ctx.stroke()
        ctx.globalAlpha = 1

        s.x += Math.cos(s.angle) * s.speed
        s.y += Math.sin(s.angle) * s.speed
        if (s.x < -200 || s.x > w + 200 || s.y < -200 || s.y > h + 200) {
          s.x = Math.random() * w
          s.y = Math.random() * h
          s.angle = Math.random() * Math.PI * 2
        }
      })

      raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }

    init()
    tick()
    window.addEventListener('resize', init)
    window.addEventListener('mousemove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', init)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <div className="cyber-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="cyber-bg-canvas" />
      <div className="cyber-bg-vignette" />
      <div className="cyber-bg-noise" />

      {/* Floating holographic shapes */}
      <div className="cyber-float cyber-hex cyber-hex-1" />
      <div className="cyber-float cyber-hex cyber-hex-2" />
      <div className="cyber-float cyber-ring cyber-ring-1" />
      <div className="cyber-float cyber-ring cyber-ring-2" />
      <div className="cyber-float cyber-cube cyber-cube-1" />
      <div className="cyber-float cyber-cube cyber-cube-2" />

      {/* Floating gaming icons */}
      <div className="cyber-float cyber-icon cyber-icon-1">🎮</div>
      <div className="cyber-float cyber-icon cyber-icon-2">🕹️</div>
      <div className="cyber-float cyber-icon cyber-icon-3">⌨️</div>
      <div className="cyber-float cyber-icon cyber-icon-4">🎧</div>
    </div>
  )
}
