import React, { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useRef } from 'react'
import axios from 'axios';
import url from './url';
export default function Navbar() {
  const bref = useRef();
  const mbtn = useRef();
  const xref = useRef();
  const ssinput = useRef();
  const divinput = useRef();
  const [games, setGames] = useState([]);
  const [search, setSerach] = useState();

  useEffect(() => {
    axios.post(url+"/search")
      .then((res) => {
        // console.log(res.data);
        setGames(res.data);
      })
  })
  
  function sfun() {
    bref.current.style.display = "none";
    // bref.current.style.display = "none";
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
    bref.current.style.display = "block";
    xref.current.style.display = "none";
    ssinput.current.style.display = "none";
    divinput.current.style.display = "none";

  }


  return (
    <>
      {/* FIXED TOP BAR */}
      <nav className="navbar    transparent-navbar">

        <div className="container-fluid mx-3  position-relative">

          {/* LEFT: Menu (Desktop) + Toggle (Mobile) */}
          <div className="d-flex align-items-center">
            {/* Toggle - Mobile only */}
            <button ref={mbtn} onClick={menubtn}
              className="navbar-toggler d-lg-none"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#mobileMenu"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* Menu - Desktop only */}
            <ul className="navbar-nav d-none d-lg-flex flex-row ms-3">
              <li className="nav-item">
                <Link className="nav-link text-light px-3" to="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link text-light px-3" to="/about">About</Link>
              </li>
            </ul>
          </div>

          {/* CENTER: Brand (All Devices, Fixed) */}
          <Link to="/" className="navbar-brand brand-center text-light">
            MyBrand
          </Link>

          {/* RIGHT: Icons */}
          <div className="d-flex align-items-center">
            <button ref={bref} onClick={sfun} className="nav-link btn text-light">
              <i className="bi bi-search fs-5 m-2"></i>
            </button>
            <button ref={xref} onClick={Showsbtn} style={{ display: 'none' }} className="nav-link btn text-light ms-2">
              <i className="bi bi-x-lg fs-4"></i>
            </button>

            {/* Move the input container to the bottom of the nav */}
            <div className="search-drop-container " ref={divinput} style={{ display: 'none' }} >
              <input
                ref={ssinput}
                className='form-control sinput-responsive'
                onChange={(e) => setSerach(e.target.value)}
                style={{ display: 'none' }}
                type="text"
                placeholder='Search Games Here...'
              />
              <div className="container">
                <div className="row">
                 {games
  .filter((game) => {
    // 1. If search is empty, don't show anything (or show all, depending on your preference)
    if (!search) return false;

    const searchTerm = search.toLowerCase();
    const nameMatch = game.name?.toLowerCase().includes(searchTerm);
    
    // 2. Check if othername is an array and if it contains the search term
    const otherNameMatch = Array.isArray(game.othername) && 
      game.othername.some(alt => alt.toLowerCase().includes(searchTerm));

    return nameMatch || otherNameMatch;
  })
  .map((game, index) => (
    <div className="card my-3 lgcard py-2  " key={game._id || index}>
      <div className="container-fluid">
        <div className="row">
          <div className="col-4 col-sm-4 col-md-5 col-lg-2">
            <img src={game.image} alt="" className='rounded' height="60px" />
          </div>
          <div className="col-8 col-sm-8 col-md-7 col-lg-10 text-center">
            <h5 className='text-light fs-6  pt-3'>{game.name}</h5>
            {/* Optional: Show which alias matched */}
          </div>
        </div>
      </div>
    </div>
  ))}


                </div>
              </div>
            </div>
          </div>


        </div>
      </nav>

      {/* MOBILE MENU (Below Fixed Bar) */}
      <div
        className="collapse  mobile-menu"
        id="mobileMenu"
      >
        <div className="container-fluid  text-center">
          <ul className="navbar-nav   text-center py-3">
            <li className="nav-item">
              <Link className="nav-link text-light" to="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link text-light" to="/about">About</Link>
            </li>
            
          </ul>
        </div>
      </div>
      <Outlet />
    </>
  )
}
