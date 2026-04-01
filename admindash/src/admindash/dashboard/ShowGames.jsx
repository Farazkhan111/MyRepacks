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
        axios.get("http://localhost:5000/show")
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

            axios.post("http://localhost:5000/tupdate", { i, trending });
            }
            else{
                alert('Cant Add more')
            }
        }
        else {
        
            e.target.innerHTML = "Not Trending";
            e.target.style.backgroundColor = "Red";
            trending = 'Not Trending';
            axios.post("http://localhost:5000/tupdate", { i, trending });
        }
    }

        function edit(id) {
            // alert(id);
            nav('/edit', { state: id })
        }
        function del(id) {
            axios.post("http://localhost:5000/del", { id })
        }
return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-sm-2 bg-dark Sidebar">
                        <Sidebar />
                    </div>
                    <div className="col-sm-10 addcontainer text-center">
                        <div className="container mt-4">
                            <div className="row">
                                <div className="col-sm-1"></div>
                                <div className="col-sm-10 showgame">
                                    <h2 className="text-center text-light mb-4 ">Show Games</h2>

                                    <table className="tab1 table table-dark table-bordered table-sm table-hover table-responsive">
                                        <thead>
                                            <tr>

                                                <th>id</th>
                                                <th>Image</th>
                                                <th>Game Name</th>
                                                {/* <th>Description</th> */}
                                                <th>Category</th>
                                                <th>Trending</th>
                                                <th>Edit</th>
                                                <th>Delete</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allgames.map((game, index) => (
                                                // Added 'return' via () and added a unique key
                                                <tr key={game._id || index}>
                                                    <td className='pt-5 '>{index + 1}</td>
                                                    <td >
                                                        <img src={game.image} height="100px" alt={game.name} />
                                                    </td >
                                                    <td className='pt-5 '>{game.name}</td>
                                                    {/* <td>{game.description}</td> */}
                                                    <td className='pt-5'>{game.category}</td>
                                                    <td>
                                                        <button className={`btn px-2 mt-4 ${game.trending === "Trending" ? 'btn-success' : 'btn-danger'}`} onClick={(e) => trend(e, game._id)}>
                                                            {game.trending}</button>
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-warning px-2 mt-4" onClick={() => edit(game._id)}>Edit</button>
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-danger px-2 mt-4" onClick={() => del(game._id)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="col-sm-1"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )

}