import React, { useEffect, useState, useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'
import axios from 'axios';
import url from './url';

export default function Navbar() {
  const bref = useRef();
  const mbtn = useRef();
  const xref = useRef();
  const ssinput = useRef();
  const divinput = useRef();

  const [games, setGames] = useState([]);
  const [search, setSerach] = useState("");

  useEffect(() => {
    axios.post(url + "/search")
      .then((res) => setGames(res.data));
  }, []);

  function sfun() {
    bref.current.style.display = "none";
    xref.current.style.display = "block";
    ssinput.current.style.display = "block";
    divinput.current.style.display = "block";
  }

  function Showsbtn() {
    bref.current.style.display = "block";
    xref.current.style.display = "none";
    ssinput.current.style.display = "none";
    divinput.current.style.display = "none";
  }

  function menubtn() {
    Showsbtn();
  }

  return (
    <>
      <nav className="navbar glass-navbar">
        <div className="container-fluid position-relative">

          {/* LEFT */}
          <div className="d-flex align-items-center">
            <button
              ref={mbtn}
              onClick={menubtn}
              className="navbar-toggler d-lg-none"
              data-bs-toggle="collapse"
              data-bs-target="#mobileMenu"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            <ul className="navbar-nav d-none d-lg-flex flex-row ms-3">
              <li className="nav-item">
                <Link className="nav-link nav-hover" to="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link nav-hover" to="/about">About</Link>
              </li>
            </ul>
          </div>

          {/* CENTER */}
          <Link to="/" className="navbar-brand brand-center neon-brand">
            MyRePacks
          </Link>

          {/* RIGHT */}
          <div className="d-flex align-items-center">
            <button ref={bref} onClick={sfun} className="nav-link btn text-light">
              <i className="bi bi-search fs-5"></i>
            </button>

            <button ref={xref} onClick={Showsbtn} style={{ display: 'none' }} className="nav-link btn text-light">
              <i className="bi bi-x-lg fs-4"></i>
            </button>

            {/* SEARCH BOX */}
            <div className="search-drop-container" ref={divinput} style={{ display: 'none' }}>
              <input
                ref={ssinput}
                className='form-control sinput-responsive'
                onChange={(e) => setSerach(e.target.value)}
                style={{ display: 'none' }}
                placeholder='Search Games...'
              />

              <div className="search-results">
                {games
                  .filter((game) => {
                    if (!search) return false;
                    const term = search.toLowerCase();
                    return (
                      game.name?.toLowerCase().includes(term) ||
                      (Array.isArray(game.othername) &&
                        game.othername.some(a => a.toLowerCase().includes(term)))
                    );
                  })
                  .map((game, i) => (
                    <div className="search-card" key={i}>
                      <img src={game.image} alt="" />
                      <span>{game.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

        </div>
      </nav>

      {/* MOBILE MENU */}
      <div className="collapse mobile-menu" id="mobileMenu">
        <ul className="navbar-nav text-center py-3">
          <li><Link className="nav-link nav-hover" to="/">Home</Link></li>
          <li><Link className="nav-link nav-hover" to="/about">About</Link></li>
        </ul>
      </div>

      <Outlet />
    </>
  )
}