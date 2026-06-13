import React, { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const trailRef = useRef([])

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return // skip on touch devices

    document.body.classList.add('cyber-cursor-active')

    let ringX = 0, ringY = 0, mx = 0, my = 0
    let raf

    const onMove = (e) => {
      mx = e.clientX
      my = e.clientY
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`
      }
      spawnTrail(mx, my)
    }

    const onDown = () => ringRef.current?.classList.add('cyber-cursor-click')
    const onUp = () => ringRef.current?.classList.remove('cyber-cursor-click')

    const onOver = (e) => {
      const interactive = e.target.closest('a, button, .game-card, .col-card, .gp-dl-btn, .hero-btn-primary, .hero-btn-secondary')
      ringRef.current?.classList.toggle('cyber-cursor-hover', !!interactive)
    }

    function spawnTrail(x, y) {
      const el = document.createElement('span')
      el.className = 'cyber-cursor-trail'
      el.style.left = x + 'px'
      el.style.top = y + 'px'
      document.body.appendChild(el)
      trailRef.current.push(el)
      setTimeout(() => {
        el.remove()
        trailRef.current.shift()
      }, 500)
      if (trailRef.current.length > 12) {
        const old = trailRef.current.shift()
        old?.remove()
      }
    }

    function loop() {
      ringX += (mx - ringX) * 0.18
      ringY += (my - ringY) * 0.18
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    loop()

    return () => {
      document.body.classList.remove('cyber-cursor-active')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      cancelAnimationFrame(raf)
      trailRef.current.forEach((el) => el.remove())
    }
  }, [])

  if (window.matchMedia('(pointer: coarse)').matches) return null

  return (
    <>
      <div ref={dotRef} className="cyber-cursor-dot" />
      <div ref={ringRef} className="cyber-cursor-ring" />
    </>
  )
}
