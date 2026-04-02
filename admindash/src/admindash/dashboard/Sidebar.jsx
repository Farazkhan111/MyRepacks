import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Sidebar() {
    const nav = useNavigate();
    const [open, setOpen] = useState(false);

    function logout() {
        localStorage.removeItem("admin");
        nav("/");
    }

    return (
        <>
            {/* 🔷 NAVBAR (Mobile + Tablet) */}
            <nav className="navbar navbar-dark bg-dark d-lg-none px-3">
                <span className="navbar-brand">My Games</span>
                <button 
                    className="btn btn-outline-light"
                    onClick={() => setOpen(!open)}
                >
                    ☰
                </button>
            </nav>

            {/* 🔷 MOBILE MENU */}
            <div className={`mobile-menu bg-dark text-white ${open ? "show" : ""}`}>
                <ul className="nav flex-column p-3">

                    <li className="nav-item my-2">
                        <Link to="/dashboard" className="nav-link text-light" onClick={()=>setOpen(false)}>🏠 Home</Link>
                    </li>

                    <li className="nav-item my-2">
                        <Link to="/add" className="nav-link text-light" onClick={()=>setOpen(false)}>➕ Add Game</Link>
                    </li>

                    <li className="nav-item my-2">
                        <Link to="/show" className="nav-link text-light" onClick={()=>setOpen(false)}>🎮 Show Game</Link>
                    </li>

                    <li className="nav-item mt-3">
                        <button onClick={logout} className="btn btn-danger w-100">Logout</button>
                    </li>

                </ul>
            </div>

            {/* 🔷 DESKTOP SIDEBAR */}
            <div className="sidebar bg-dark text-white d-none d-lg-block">
                <div className="p-3">
                    <h3 className="text-center mb-4">My Games</h3>

                    <ul className="nav flex-column">

                        <li className="nav-item my-2">
                            <Link to="/dashboard" className="nav-link text-light">🏠 Home</Link>
                        </li>

                        <li className="nav-item my-2">
                            <Link to="/add" className="nav-link text-light">➕ Add Game</Link>
                        </li>

                        <li className="nav-item my-2">
                            <Link to="/show" className="nav-link text-light">🎮 Show Game</Link>
                        </li>

                        <li className="nav-item mt-4 text-center">
                            <button onClick={logout} className="btn btn-danger w-75">
                                Logout
                            </button>
                        </li>

                    </ul>
                </div>
            </div>
        </>
    )
}