import React, { useEffect, useState } from "react";
import Sidebar   from "./Sidebar";
import axios     from "axios";
import { useNavigate } from "react-router-dom";
import url       from "./url/url";

export default function ShowGames() {
  const [games,          setGames]          = useState([]);
  const [trendingCount,  setTrendingCount]  = useState(0);
  const [filter,         setFilter]         = useState("All");
  const [selected,       setSelected]       = useState(new Set());   // ← NEW: bulk select
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    axios.get(url + "/show").then(res => {
      setGames(res.data);
      setTrendingCount(res.data.filter(g => g.trending === "Trending").length);
    }).catch(err => console.log(err));
  }, []);

  const toggleTrending = (id, current) => {
    if (current === "Not Trending" && trendingCount >= 8) { alert("Max 8 trending allowed"); return; }
    const newStatus = current === "Trending" ? "Not Trending" : "Trending";
    setTrendingCount(prev => current === "Trending" ? prev - 1 : prev + 1);
    axios.post(url + "/tupdate", { i: id, trending: newStatus });
    setGames(prev => prev.map(g => g._id === id ? { ...g, trending: newStatus } : g));
  };

  const editGame   = (id) => nav("/edit", { state: id });
  const deleteGame = (id) => {
    if (!window.confirm("Delete this game?")) return;
    axios.post(url + "/del", { id });
    setGames(prev => prev.filter(g => g._id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  // ── Checkbox helpers ──────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const filtered      = games.filter(g => filter === "All" || g.platform === filter || (!g.platform && filter === "PC"));
  const allChecked    = filtered.length > 0 && filtered.every(g => selected.has(g._id));
  const someChecked   = filtered.some(g => selected.has(g._id));

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(g => s.delete(g._id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(g => s.add(g._id));    return s; });
    }
  };

  // ── Bulk Delete ───────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected game(s)?`)) return;
    setBulkDeleting(true);
    try {
      await axios.post(url + "/bulk-delete", { ids: [...selected] });
      setGames(prev => prev.filter(g => !selected.has(g._id)));
      setSelected(new Set());
    } catch (err) {
      alert("Bulk delete failed: " + err.message);
    }
    setBulkDeleting(false);
  };

  const pcCount     = games.filter(g => !g.platform || g.platform === "PC").length;
  const mobileCount = games.filter(g => g.platform === "Mobile").length;

  return (
    <>
      <Sidebar />
      <div className="games-main">
        <div className="games-container">
          <h2>🎮 Manage Games</h2>

          {/* Platform filter tabs */}
          <div className="platform-filter-tabs">
            {[
              { key: "All",    label: `All (${games.length})` },
              { key: "PC",     label: `💻 PC (${pcCount})` },
              { key: "Mobile", label: `📱 Mobile (${mobileCount})` },
            ].map(t => (
              <button
                key={t.key}
                className={`platform-tab-btn ${filter === t.key ? "active" : ""}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Bulk delete toolbar */}
          {someChecked && (
            <div className="bulk-toolbar">
              <span>{selected.size} selected</span>
              <button
                className="bulk-delete-btn"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting…" : `🗑 Delete Selected (${selected.size})`}
              </button>
              <button
                className="bulk-clear-btn"
                onClick={() => setSelected(new Set())}
              >
                ✕ Clear
              </button>
            </div>
          )}

          <div className="games-table-wrapper">
            <table className="games-table">
              <thead>
                <tr>
                  {/* Select-all checkbox */}
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>Game</th>
                  <th>Platform</th>
                  <th>Category</th>
                  <th>Trending</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((game, i) => (
                  <tr key={game._id} className={selected.has(game._id) ? "row-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(game._id)}
                        onChange={() => toggleSelect(game._id)}
                      />
                    </td>
                    <td>{i + 1}</td>
                    <td className="game-info">
                      <img src={game.image} alt={game.name} />
                      <span>{game.name}</span>
                    </td>
                    <td>
                      <span className={`platform-badge ${game.platform === "Mobile" ? "badge-mobile" : "badge-pc"}`}>
                        {game.platform === "Mobile" ? "📱 Mobile" : "💻 PC"}
                      </span>
                    </td>
                    <td>{game.category}</td>
                    <td>
                      <div
                        className={`trending-switch ${game.trending === "Trending" ? "active" : ""}`}
                        onClick={() => toggleTrending(game._id, game.trending)}
                      >
                        <div className="switch-circle"></div>
                      </div>
                    </td>
                    <td>
                      <button className="edit-btn"   onClick={() => editGame(game._id)}>Edit</button>
                      <button className="delete-btn" onClick={() => deleteGame(game._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
