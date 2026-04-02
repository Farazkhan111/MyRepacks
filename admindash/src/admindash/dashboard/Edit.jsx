import React, { useEffect, useState } from 'react'
import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Edit() {
    const location = useLocation();
    const [gname, setName] = useState("");
    const [gimage, setImage] = useState("");
    const [gfimage, setFimage] = useState("");
    const [gvideo, setVideo] = useState("");
    const [glink, setLink] = useState();
    const [gdes, setDes] = useState("");
    const [gcat, setCat] = useState("");
    
    const [othername, setOthername] = useState([]); // This stores the array
    const [currentAlias, setCurrentAlias] = useState(""); // For the typing text

    const id = location.state;
    const nav = useNavigate();

    useEffect(() => {
        axios.post("https://myrepacks.onrender.com/edit", { id })
            .then((res) => {
                setName(res.data.name);
                setImage(res.data.image);
                setLink(res.data.link);
                setFimage(res.data.fimage);
                setVideo(res.data.video);
                setDes(res.data.description);
                setCat(res.data.category);
                // Ensure othername is an array when loading from DB
                setOthername(res.data.othername || []);
            })
    }, [id])

    function update() {
        axios.post("https://myrepacks.onrender.com/gupdate", { id, gname, gimage, gdes, gcat, gfimage, glink, gvideo, othername })
            .then(() => {
                nav("/show");
            })
    }

    const handleAddName = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            if (currentAlias.trim()) {
                // Add to array only if it doesn't already exist
                if(!othername.includes(currentAlias.trim())){
                    setOthername([...othername, currentAlias.trim()]);
                }
                setCurrentAlias(""); 
            }
        }
    };

    // Function to remove a name from the list
    const removeName = (indexToRemove) => {
        setOthername(othername.filter((_, index) => index !== indexToRemove));
    };

   return (
    <>
        {/* Sidebar + Navbar */}
        <Sidebar />

        {/* Main Content */}
        <div className="main-content addcontainer pt-4">
            <div className="container mt-4">
                <div className="row justify-content-center">

                    <div className="col-lg-6 col-md-10 addgames text-center">
                        <h2 className="text-light mt-4">EDIT GAME</h2>

                        {/* ✅ use form submit */}
                        <form className="px-4" onSubmit={(e) => {
                            e.preventDefault();
                            update();
                        }}>

                            <input
                                className="form-control mt-4"
                                type="text"
                                value={gname}
                                placeholder="Enter Game Name"
                                onChange={(e) => setName(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                value={gimage}
                                placeholder="Enter Game Image link"
                                onChange={(e) => setImage(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                value={gfimage}
                                placeholder="Enter Game FImage link"
                                onChange={(e) => setFimage(e.target.value)}
                            />

                            <input
                                className="form-control mt-4"
                                type="text"
                                value={gvideo}
                                placeholder="Enter Game Video link"
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
                                value={gdes}
                                placeholder="Enter Game description"
                                onChange={(e) => setDes(e.target.value)}
                            />

                            <select
                                className="form-select mt-4"
                                value={gcat}
                                onChange={(e) => setCat(e.target.value)}
                            >
                                <option value="">Select Category</option>
                                <option value="Roleplay">Roleplay</option>
                                <option value="Simulation">Simulation</option>
                                <option value="Sports">Sports</option>
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
                                Update
                            </button>

                        </form>
                    </div>

                </div>
            </div>
        </div>
    </>
);
}
