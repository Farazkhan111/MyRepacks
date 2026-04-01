import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Collection() {
    const [allgames, setGames] = useState([]);
    const [selecvalue, setSval] = useState("AllGames");
    const nav=useNavigate();
    useEffect(() => {
        axios.get("http://localhost:5000/collection")
            .then((res) => {
                console.log(res.data);
                setGames(res.data);
            })
    }, [])
    function showgame(id){
        // alert(id);
        nav("/gamepage",{state:id});
    }
    return (

        <div className="dashboard-wrapper">
            <div className="container-fluid">
                <div className="row ">
                    <div className="col-12 mb-4">
                        <select className='game-select' value={selecvalue} onChange={(e) => setSval(e.target.value)} id="sel">
                            <option value="AllGames" defaultChecked>All Games</option>
                            <option value="Roleplay">Roleplay</option>
                            <option value="Simulation">Simulation</option>
                            <option value="Sports">Sports</option>
                        </select>
                    </div>

                    {allgames.map((game, index) => (
                        (selecvalue === "AllGames" || selecvalue === game.category) ? (
                        
                            <div className="col-lg-4 col-md-6 col-sm-6 mb-5" onClick={()=>showgame(game._id)}  style={{ cursor: 'pointer' }} key={index}>
                                <div className="neon-card-container">
                                    {/* 1. THE NEON GLOW (Blurred image behind the card) */}
                                    <div className="neon-reflection" style={{ backgroundImage: `url(${game.fimage})` }}></div>

                                    <div className="game-card" >
                                        {/* 2. THE INNER GLASS CONTENT */}
                                        <div className="card-image-container">
                                            <img className='cardimg' src={game.fimage} alt={game.name} />
                                        </div>
                                        <div className="card-content">
                                            <h4 className="game-title">{game.name}</h4>
                                            <div className="neon-line"></div> {/* Decorative neon line */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                        ) : null
                    ))}

                </div>
            </div>
        </div>
    )
}
