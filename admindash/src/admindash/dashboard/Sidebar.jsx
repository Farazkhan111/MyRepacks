import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const nav      = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  function logout() {
    localStorage.removeItem("admin");
    nav("/");
  }

  const menu = [
    { path: "/dashboard", name: "Home",         icon: "🏠" },
    { path: "/add",       name: "Add Game",      icon: "➕" },
    { path: "/show",      name: "Show Game",     icon: "🎮" },
    { path: "/scraper",   name: "Scraper",       icon: "🔗" },
    { path: "/import",    name: "Import Games",  icon: "📥" },
    { path: "/autoupdate",name: "Auto Update",   icon: "🔄" },
  ];

  return (
    <>
      {/* MOBILE TOPBAR */}
      <div className="topbar">
        <span>🎮 My Games</span>
        <button onClick={() => setOpen(true)}>☰</button>
      </div>

      {/* OVERLAY */}
      <div
        className={`overlay ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      ></div>

      {/* SIDEBAR */}
      <div className={`sidebar ${open ? "active" : ""}`}>
        <div>
          <h2 className="logo">🎮 My Games</h2>
          <ul>
            {menu.map((item, i) => (
              <li key={i}>
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? "active" : ""}
                  onClick={() => setOpen(false)}
                >
                  {item.icon} {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <button className="logout" onClick={logout}>
          🚪 Logout
        </button>
      </div>
    </>
  );
}
