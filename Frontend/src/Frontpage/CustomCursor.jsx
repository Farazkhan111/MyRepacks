import React, { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const trailRef = useRef([])

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const trails = trailRef.current

    document.body.classList.add('cyber-cursor-active')

    let ringX = 0
    let ringY = 0
    let mx = 0
    let my = 0
    let raf

    const onMove = (e) => {
      mx = e.clientX
      my = e.clientY

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`
      }

      spawnTrail(mx, my)
    }

    const onDown = () => {
      ringRef.current?.classList.add('cyber-cursor-click')
    }

    const onUp = () => {
      ringRef.current?.classList.remove('cyber-cursor-click')
    }

    const onOver = (e) => {
      const interactive = e.target.closest(
        'a, button, .game-card, .col-card, .gp-dl-btn, .hero-btn-primary, .hero-btn-secondary'
      )

      ringRef.current?.classList.toggle(
        'cyber-cursor-hover',
        !!interactive
      )
    }

    function spawnTrail(x, y) {
      const el = document.createElement('span')

      el.className = 'cyber-cursor-trail'
      el.style.left = `${x}px`
      el.style.top = `${y}px`

      document.body.appendChild(el)
      trails.push(el)

      setTimeout(() => {
        el.remove()
        const index = trails.indexOf(el)
        if (index > -1) {
          trails.splice(index, 1)
        }
      }, 500)

      if (trails.length > 12) {
        const old = trails.shift()
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

      if (raf) {
        cancelAnimationFrame(raf)
      }

      trails.forEach((el) => el.remove())
      trails.length = 0
    }
  }, [])

  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
  ) {
    return null
  }

  return (
    <>
      <div ref={dotRef} className="cyber-cursor-dot" />
      <div ref={ringRef} className="cyber-cursor-ring" />
    </>
  )
}