import React, { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
export default function AddGames() {
    const [gname, setName] = useState();
    const [gimage, setImage] = useState();
    const [glink, setLink] = useState();
    const [gfimage, setFimage] = useState();
    const [gdes, setDes] = useState();
    const [gcat, setCat] = useState();
    const [gvideo, setVideo] = useState("");
    const [othername, setOthername] = useState([]);
    const [gtrend, setTrend] = useState();
    const [currentAlias, setCurrentAlias] = useState("");
    const nav = useNavigate();
    useEffect(() => {
        const user = localStorage.getItem("admin");
        if (user) {

        }
        else {
            nav("/");

        }
    }, [nav])
    function addgame(e) {
        e.preventDefault(); // 🚀 important

        axios.post("https://myrepacks.onrender.com/add", {
            gname, gimage, gdes, gcat, gfimage, glink, gtrend, gvideo, othername
        })
            .then(res => {
                console.log(res.data);
                alert("Game added successfully");
            })
            .catch(err => {
                console.log(err);
            });
    }
    const handleAddName = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentAlias.trim()) {
                // Add to array only if it doesn't already exist
                if (!othername.includes(currentAlias.trim())) {
                    setOthername([...othername, currentAlias.trim()]);
                }
                setCurrentAlias("");
            }
        }
    };
    const removeName = (indexToRemove) => {
        setOthername(othername.filter((_, index) => index !== indexToRemove));
    };
 
   return (
    <>
        {/* Sidebar + Navbar */}
        <Sidebar />

        {/* Main Content */}
        <div className="main-content addcontainer">
            <div className="container mt-4">
                <div className="row justify-content-center">

                    <div className="col-lg-6 col-md-10 addgames text-center">
                        <h2 className="text-light mt-4">ADD GAMES</h2>

                        <form className="px-4" onSubmit={addgame}>

                            <input
                                className="form-control mt-4"
                                type="text"
                                placeholder="Enter Game name"
                                value={gname || ""}
                                onChange={(e) => setName(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                placeholder="Enter Game Image link"
                                value={gimage || ""}
                                onChange={(e) => setImage(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                placeholder="Enter Game fImage link"
                                value={gfimage || ""}
                                onChange={(e) => setFimage(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                placeholder="Enter Game video link"
                                value={gvideo}
                                onChange={(e) => setVideo(e.target.value)}
                            />

                            {/* Alias Input */}
                            <div className="form-control mt-4 d-flex flex-wrap align-items-center">
                                {othername.map((name, index) => (
                                    <span key={index} className="badge bg-primary me-2 my-1 d-flex align-items-center">
                                        {name}
                                        <button
                                            type="button"
                                            onClick={() => removeName(index)}
                                            className="btn-close btn-close-white ms-2"
                                            style={{ fontSize: '0.5rem' }}
                                        ></button>
                                    </span>
                                ))}

                                <input
                                    type="text"
                                    value={currentAlias}
                                    onChange={(e) => setCurrentAlias(e.target.value)}
                                    onKeyDown={handleAddName}
                                    placeholder="Add names..."
                                    style={{ border: 'none', outline: 'none', flexGrow: 1 }}
                                />
                            </div>

                            <textarea
                                className="form-control mt-4"
                                placeholder="Enter Game description"
                                value={gdes || ""}
                                onChange={(e) => setDes(e.target.value)}
                            />

                            <select
                                className="form-select mt-4"
                                onChange={(e) => setCat(e.target.value)}
                            >
                                <option>Select Category</option>
                                <option value="Roleplay">Roleplay</option>
                                <option value="Simulation">Simulation</option>
                                <option value="Sports">Sports</option>
                            </select>

                            <select
                                className="form-select mt-4"
                                onChange={(e) => setTrend(e.target.value)}
                            >
                                <option>Select Trending</option>
                                <option value="Not Trending">Not Trending</option>
                                <option value="Trending">Trending</option>
                            </select>

                            <input
                                type="text"
                                className="form-control mt-4"
                                placeholder="Download Link here"
                                value={glink || ""}
                                onChange={(e) => setLink(e.target.value)}
                            />

                            <button
                                type="submit"
                                className="btn btn-primary mt-4 mb-4 btn-lg px-5"
                            >
                                Submit
                            </button>

                        </form>
                    </div>

                </div>
            </div>
        </div>
    </>
)}
