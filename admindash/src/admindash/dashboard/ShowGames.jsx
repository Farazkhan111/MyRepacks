import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ShowGames() {
  const [games, setGames] = useState([]);
  const [trendingCount, setTrendingCount] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    axios.get("https://myrepacks.onrender.com/show")
      .then(res => {
        setGames(res.data);
        const count = res.data.filter(g => g.trending === "Trending").length;
        setTrendingCount(count);
      })
      .catch(err => console.log(err));
  }, []);

  const toggleTrending = (id, current) => {
    if (current === "Not Trending" && trendingCount >= 8) {
      alert("Max 8 trending allowed");
      return;
    }
    const newStatus = current === "Trending" ? "Not Trending" : "Trending";
    setTrendingCount(prev => current === "Trending" ? prev - 1 : prev + 1);

    axios.post("https://myrepacks.onrender.com/tupdate", { i: id, trending: newStatus });

    setGames(prev => prev.map(g => g._id === id ? { ...g, trending: newStatus } : g));
  };

  const editGame = (id) => nav("/edit", { state: id });
  const deleteGame = (id) => {
    axios.post("https://myrepacks.onrender.com/del", { id });
    setGames(prev => prev.filter(g => g._id !== id));
  };

  return (
    <>
      <Sidebar />
      <div className="games-main">
        <div className="games-container">
          <h2>🎮 Manage Games</h2>
          <div className="games-table-wrapper">
            <table className="games-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Game</th>
                  <th>Category</th>
                  <th>Trending</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game, i) => (
                  <tr key={game._id}>
                    <td>{i + 1}</td>
                    <td className="game-info">
                      <img src={game.image} alt={game.name} />
                      <span>{game.name}</span>
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
                      <button className="edit-btn" onClick={() => editGame(game._id)}>Edit</button>
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