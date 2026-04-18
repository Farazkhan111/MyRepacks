import React, { useEffect, useState, useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'
import axios from 'axios'
import url from './url'

export default function Navbar() {
  const searchInputRef = useRef()
  const dropdownRef = useRef()

  const [games, setGames] = useState([])
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    axios.post(url + '/search').then((res) => setGames(res.data))
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setSearch('')
    }
  }, [searchOpen])

  // Close search on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = games.filter((g) => {
    if (!search) return false
    const t = search.toLowerCase()
    return (
      g.name?.toLowerCase().includes(t) ||
      (Array.isArray(g.othername) && g.othername.some((a) => a.toLowerCase().includes(t)))
    )
  })

  return (
    <>
      <nav className={`navbar-root ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-container">

          {/* LEFT — nav links (desktop) / hamburger (mobile) */}
          <div className="navbar-left">
            {/* Desktop nav links */}
            <ul className="nav-links-desktop">
              {[
                { to: '/', label: 'Home' },
                { to: '/collection', label: 'Games' },
                { to: '/about', label: 'About' },
              ].map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="nav-link-item">
                    <span>{label}</span>
                    <span className="nav-link-underline" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Mobile hamburger */}
            <button
              className={`hamburger-btn ${mobileOpen ? 'open' : ''}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <span className="hline" />
              <span className="hline" />
              <span className="hline" />
            </button>
          </div>

          {/* CENTER — brand */}
          <div className="navbar-brand-wrap">
            <Link to="/" className="navbar-brand">
              <span className="brand-accent">My</span> <span className='text-light'>RePacks</span>
            </Link>
          </div>

          {/* RIGHT — search */}
          <div className="navbar-right" ref={dropdownRef}>
            <button
              className={`search-toggle-btn ${searchOpen ? 'active' : ''}`}
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search"
            >
              {searchOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <span className="search-btn-label">Search</span>
            </button>

            {/* Search dropdown */}
            <div className={`search-dropdown ${searchOpen ? 'search-dropdown-open' : ''}`}>
              <div className="search-input-wrap">
                <svg className="search-icon-inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search games..."
                />
              </div>
              <div className="search-results-list">
                {search && filtered.length === 0 && (
                  <div className="search-empty">No games found for "{search}"</div>
                )}
                {filtered.map((game, i) => (
                  <Link
                    to="/gamepage"
                    state={game._id}
                    className="search-result-item"
                    key={i}
                    onClick={() => setSearchOpen(false)}
                  >
                    <img src={game.image} alt={game.name} className="search-result-img" />
                    <div className="search-result-info">
                      <span className="search-result-name">{game.name}</span>
                      {game.category && <span className="search-result-cat">{game.category}</span>}
                    </div>
                    <svg className="search-result-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className={`mobile-drawer ${mobileOpen ? 'mobile-drawer-open' : ''}`}>
          <div className="mobile-drawer-inner">
            {[
              { to: '/', label: 'Home' },
              { to: '/collection', label: 'Games' },
              { to: '/about', label: 'About' },
            ].map(({ to, label }) => (
              <Link
                key={label}
                to={to}
                className="mobile-nav-link"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <Outlet />
    </>
  )
}
