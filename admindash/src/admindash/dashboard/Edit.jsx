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
        axios.post("http://localhost:5000/edit", { id })
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
        axios.post("http://localhost:5000/gupdate", { id, gname, gimage, gdes, gcat, gfimage, glink, gvideo, othername })
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
        <div className="container-fluid addcontainer ">
            <div className="row">
                <div className="col-sm-2 bg-dark">
                    <Sidebar />
                </div>
                <div className="col-sm-10 addcontainer pt-5 text-center">
                    <div className=" container mt-4 ">
                        <div className="row ">
                            <div className="col-sm-3"></div>
                            <div className="col-sm-6 addgames" >
                                <h2 className="text-center text-light mt-4 ">EDIT GAMES</h2>
                                <form className="text-center px-5" >
                                    <input className="form-control mt-5" type="text" value={gname} placeholder='Enter Game Name' onChange={(e) => setName(e.target.value)} />
                                    <input className="form-control mt-5" type="text" value={gimage} onChange={(e) => setImage(e.target.value)} placeholder='Enter Game Image link' />
                                    <input className="form-control mt-5" type="text" value={gfimage} onChange={(e) => setFimage(e.target.value)} placeholder='Enter Game FImage link' />
                                    <input className="form-control mt-5" type="text" value={gvideo} onChange={(e) => setVideo(e.target.value)} placeholder='Enter Game Video link' />

                                    {/* VISUAL ARRAY INPUT START */}
                                    <div className="form-control mt-5 d-flex flex-wrap align-items-center" style={{ minHeight: '45px', textAlign: 'left' }}>
                                        {othername.map((name, index) => (
                                            <span key={index} className="badge bg-primary d-flex align-items-center me-2 my-1">
                                                {name}
                                                <button type="button" onClick={() => removeName(index)} className="btn-close btn-close-white ms-2" style={{ fontSize: '0.5rem' }}></button>
                                            </span>
                                        ))}
                                        <input 
                                            type="text" 
                                            value={currentAlias} 
                                            onChange={(e) => setCurrentAlias(e.target.value)} 
                                            onKeyDown={handleAddName} 
                                            placeholder='Add names...' 
                                            style={{ border: 'none', outline: 'none', flexGrow: 1, minWidth: '100px' }} 
                                        />
                                    </div>
                                    {/* VISUAL ARRAY INPUT END */}

                                    <textarea className="form-control mt-5" value={gdes} onChange={(e) => setDes(e.target.value)} placeholder="Enter Game description" />

                                    <select name="Gcat" required onChange={(e) => setCat(e.target.value)} className='form-select mt-5' >
                                        <option value={gcat}>{gcat}</option>
                                        <option value="Roleplay">Roleplay</option>
                                        <option value="Simulation">Simulation</option>
                                        <option value="Sports">Sports</option>
                                    </select>
                                    
                                    <input type="text" className="form-control mt-5" placeholder='Download Link here ' value={glink} onChange={(e) => setLink(e.target.value)} />
                                    
                                    <button type='button' className="btn btn-primary mt-5 mb-3 btn-lg px-5" onClick={() => update()}>Update</button>
                                </form>
                            </div>
                            <div className="col-sm-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
