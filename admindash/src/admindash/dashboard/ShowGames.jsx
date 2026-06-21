import React, { useEffect, useState, useRef } from "react";
import Sidebar    from "./Sidebar";
import axios      from "axios";
import { useNavigate } from "react-router-dom";
import url        from "./url/url";

export default function ShowGames() {
  const searchInputRef = useRef();
  const searchDropRef  = useRef();

  const [games,        setGames]        = useState([]);
  const [trendingCount,setTrendingCount]= useState(0);
  const [filter,       setFilter]       = useState("All");
  const [search,       setSearch]       = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [sort,         setSort]         = useState("newest");
  const [selected,     setSelected]     = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    axios.get(url + "/show").then(res => {
      setGames(res.data);
      setTrendingCount(res.data.filter(g => g.trending === "Trending").length);
    }).catch(err => console.log(err));
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
    else setSearch("");
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (searchDropRef.current && !searchDropRef.current.contains(e.target))
        setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTrending = (e, id, current) => {
    e.stopPropagation();
    if (current === "Not Trending" && trendingCount >= 16) { alert("Max 8 trending allowed"); return; }
    const newStatus = current === "Trending" ? "Not Trending" : "Trending";
    setTrendingCount(prev => current === "Trending" ? prev - 1 : prev + 1);
    axios.post(url + "/tupdate", { i: id, trending: newStatus });
    setGames(prev => prev.map(g => g._id === id ? { ...g, trending: newStatus } : g));
  };

  const deleteGame = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this game?")) return;
    axios.post(url + "/del", { id });
    setGames(prev => prev.filter(g => g._id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const getCreatedAt = (g) => g.createdAt ? new Date(g.createdAt) : new Date(parseInt(g._id.substring(0, 8), 16) * 1000);
  const getUpdatedAt = (g) => g.updatedAt ? new Date(g.updatedAt) : getCreatedAt(g);

  const tableRows = games
    .filter(g => {
      if (filter === "All")      return true;
      if (filter === "Trending") return g.trending === "Trending";
      if (filter === "PC")       return !g.platform || g.platform === "PC";
      if (filter === "Mobile")   return g.platform === "Mobile";
      return true;
    })
    .sort((a, b) => {
      if (sort === "newest")   return getCreatedAt(b) - getCreatedAt(a);
      if (sort === "oldest")   return getCreatedAt(a) - getCreatedAt(b);
      if (sort === "az")       return (a.name || "").localeCompare(b.name || "");
      if (sort === "za")       return (b.name || "").localeCompare(a.name || "");
      if (sort === "modified") return getUpdatedAt(b) - getUpdatedAt(a);
      return 0;
    });

  const searchResults = games.filter(g => {
    if (!search) return false;
    const t = search.toLowerCase();
    return (
      g.name?.toLowerCase().includes(t) ||
      (Array.isArray(g.othername) && g.othername.some(a => a.toLowerCase().includes(t)))
    );
  });

  const someChecked = tableRows.some(g => selected.has(g._id));
  const allSelected = tableRows.length > 0 && tableRows.every(g => selected.has(g._id));

  const toggleSelectAll = () => {
    setSelected(prev => {
      if (allSelected) {
        // Deselect just the currently-visible rows, keep any selection
        // from outside the current filter intact.
        const s = new Set(prev);
        tableRows.forEach(g => s.delete(g._id));
        return s;
      }
      // Select all currently-visible (filtered) rows, on top of whatever
      // was already selected.
      const s = new Set(prev);
      tableRows.forEach(g => s.add(g._id));
      return s;
    });
  };

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

          {/* Header */}
          <div className="sg-header">
            <div className="sg-header-left">
              <h2 className="sg-title">🎮 Manage Games</h2>
              <span className="sg-total-badge">{tableRows.length} games</span>
            </div>

            {/* Search */}
            <div className="sg-search-wrap" ref={searchDropRef}>
              <button
                className={`sg-search-toggle ${searchOpen ? "active" : ""}`}
                onClick={() => setSearchOpen(o => !o)}
              >
                {searchOpen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                )}
                <span>Search</span>
              </button>

              <div className={`sg-search-dropdown ${searchOpen ? "open" : ""}`}>
                <div className="sg-search-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    ref={searchInputRef}
                    className="sg-search-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or alias…"
                  />
                  {search && <button className="sg-search-clear" onClick={() => setSearch("")}>✕</button>}
                </div>
                <div className="sg-search-results">
                  {search && searchResults.length === 0 && (
                    <div className="sg-search-empty">No games found for "{search}"</div>
                  )}
                  {searchResults.map((game, i) => (
                    <div key={i} className="sg-search-result-item"
                      onClick={() => { nav("/edit", { state: game._id }); setSearchOpen(false); }}>
                      <img src={game.image} alt={game.name} className="sg-result-img" />
                      <div className="sg-result-info">
                        <span className="sg-result-name">{game.name}</span>
                        <div className="sg-result-meta">
                          {game.category && <span className="sg-result-cat">{game.category}</span>}
                          <span className="search-result-platform">{game.platform === "Mobile" ? "📱" : "💻"}</span>
                        </div>
                      </div>
                      <svg className="sg-result-arrow" width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filters row */}
          <div className="sg-filters">
            <label className="sg-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                disabled={tableRows.length === 0}
              />
              <span>Select All</span>
            </label>

            <div className="platform-filter-tabs">
              {[
                { key: "All",      label: `All (${games.length})` },
                { key: "PC",       label: `💻 PC (${pcCount})` },
                { key: "Mobile",   label: `📱 Mobile (${mobileCount})` },
                { key: "Trending", label: `🔥 Trending (${trendingCount})` },
              ].map(t => (
                <button key={t.key}
                  className={`platform-tab-btn ${filter === t.key ? "active" : ""}`}
                  onClick={() => setFilter(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="sg-sort-wrap">
              <svg className="sg-sort-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6"  x2="20" y2="6"/>
                <line x1="4" y1="12" x2="14" y2="12"/>
                <line x1="4" y1="18" x2="9"  y2="18"/>
              </svg>
              <select className="sg-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="newest">🕒 Newest First</option>
                <option value="oldest">🕰 Oldest First</option>
                <option value="az">🔤 A → Z</option>
                <option value="za">🔤 Z → A</option>
                <option value="modified">✏️ Last Modified</option>
              </select>
            </div>
          </div>

          {/* Bulk toolbar */}
          {someChecked && (
            <div className="bulk-toolbar">
              <span>{selected.size} selected</span>
              {!allSelected && (
                <button className="bulk-selectall-btn" onClick={toggleSelectAll}>Select all {tableRows.length}</button>
              )}
              <button className="bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? "Deleting…" : `🗑 Delete (${selected.size})`}
              </button>
              <button className="bulk-clear-btn" onClick={() => setSelected(new Set())}>✕ Clear</button>
            </div>
          )}

          {/* Cards grid */}
          {tableRows.length === 0 ? (
            <div className="sg-empty-state">
              <span>🎮</span>
              <p>No games found</p>
            </div>
          ) : (
            <div className="sg-cards-grid">
              {tableRows.map(game => (
                <div
                  key={game._id}
                  className={`sg-card ${selected.has(game._id) ? "sg-card-selected" : ""}`}
                  onClick={() => nav("/edit", { state: game._id })}
                >
                  {/* Cover image */}
                  <div className="sg-card-img-wrap">
                    <img src={game.fimage || game.image} alt={game.name} className="sg-card-cover" />
                    <div className="sg-card-overlay" />

                    {/* Top-left checkbox */}
                    <div className="sg-card-checkbox" onClick={e => toggleSelect(e, game._id)}>
                      <input type="checkbox" checked={selected.has(game._id)} onChange={() => {}} />
                    </div>

                    {/* Top-right trending badge */}
                    <div
                      className={`sg-card-trending ${game.trending === "Trending" ? "trending-on" : "trending-off"}`}
                      onClick={e => toggleTrending(e, game._id, game.trending)}
                      title={game.trending === "Trending" ? "Remove from trending" : "Add to trending"}
                    >
                      {game.trending === "Trending" ? "🔥 Trending" : "➕ Trending"}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="sg-card-body">
                    <div className="sg-card-thumb-row">
                      <img src={game.image} alt={game.name} className="sg-card-thumb" />
                      <div className="sg-card-meta">
                        <p className="sg-card-name">{game.name}</p>
                        <div className="sg-card-tags">
                          {game.category && <span className="sg-card-cat">{game.category}</span>}
                          <span className={`platform-badge ${game.platform === "Mobile" ? "badge-mobile" : "badge-pc"}`}>
                            {game.platform === "Mobile" ? "📱 Mobile" : "💻 PC"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="sg-card-footer">
                      <span className="sg-card-edit-hint">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Click to edit
                      </span>
                      <button
                        className="sg-card-delete-btn"
                        onClick={e => deleteGame(e, game._id)}
                        title="Delete game"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}