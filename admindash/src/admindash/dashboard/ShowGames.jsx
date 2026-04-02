import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Removed: import { data } from 'react-router-dom'; (Not being used)

export default function ShowGames() {
    const [allgames, setGames] = useState([]);
    const [ttot,setTtot]=useState();
    const nav = useNavigate();
    useEffect(() => {
        axios.get("https://myrepacks.onrender.com/show")
            .then((res) => {
                setGames(res.data);
                let count=0;
                 res.data.forEach((game)=>{
                        if(game.trending==="Trending"){
                         count++;
                        }
                        setTtot(count);
                        console.log(count);
                    })
            })
            .catch(err => console.log(err));
            
            
        });

     function trend(e, id) {
        var trending;
        var i = id;
        // const [tonly,setTonly]=useState(0);

        // var tn;
        // Directly change the HTML of the clicked element
        if (e.target.innerHTML === "Not Trending") {
            if(ttot<8){
            e.target.innerHTML = "Trending";
            trending = 'Trending';
            e.target.style.backgroundColor = "Green";

            axios.post("https://myrepacks.onrender.com/tupdate", { i, trending });
            }
            else{
                alert('Cant Add more')
            }
        }
        else {
        
            e.target.innerHTML = "Not Trending";
            e.target.style.backgroundColor = "Red";
            trending = 'Not Trending';
            axios.post("https://myrepacks.onrender.com/tupdate", { i, trending });
        }
    }

        function edit(id) {
            // alert(id);
            nav('/edit', { state: id })
        }
        function del(id) {
            axios.post("https://myrepacks.onrender.com/del", { id })
        }
return (
    <>
        {/* Sidebar + Navbar */}
        <Sidebar />

        {/* Main Content */}
        <div className="main-content addcontainer">
            <div className="container mt-4">
                <div className="row justify-content-center">

                    <div className="col-lg-10 col-md-11 showgame">
                        <h2 className="text-center text-light mb-4">Show Games</h2>

                        <div className="table-responsive">
                            <table className="table table-dark table-bordered table-hover text-center">

                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Image</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Trending</th>
                                        <th>Edit</th>
                                        <th>Delete</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {allgames.map((game, index) => (
                                        <tr key={game._id || index}>
                                            
                                            <td className="align-middle">{index + 1}</td>

                                            <td>
                                                <img 
                                                    src={game.image} 
                                                    alt={game.name} 
                                                    style={{ height: "80px", borderRadius: "10px" }} 
                                                />
                                            </td>

                                            <td className="align-middle">{game.name}</td>

                                            <td className="align-middle">{game.category}</td>

                                            <td>
                                                <button 
                                                    className={`btn mt-2 ${game.trending === "Trending" ? 'btn-success' : 'btn-danger'}`}
                                                    onClick={(e) => trend(e, game._id)}
                                                >
                                                    {game.trending}
                                                </button>
                                            </td>

                                            <td>
                                                <button 
                                                    className="btn btn-warning mt-2"
                                                    onClick={() => edit(game._id)}
                                                >
                                                    Edit
                                                </button>
                                            </td>

                                            <td>
                                                <button 
                                                    className="btn btn-danger mt-2"
                                                    onClick={() => del(game._id)}
                                                >
                                                    Delete
                                                </button>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    </>
)
}