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
    const nav = useNavigate();
    useEffect(() => {
        const user = localStorage.getItem("admin");
        if (user) {

        }
        else {
            nav("/");

        }
    }, [])
    function addgame() {
        axios.post("https://myrepacks.onrender.com/add", { gname, gimage, gdes, gcat, gfimage, glink, gtrend, gvideo, othername });
    }
    return (
        <div className="container-fluid ">
            <div className="row ">
                <div className="col-sm-2 bg-dark">
                    <Sidebar />
                </div>
                <div className="col-sm-10 addcontainer text-center">
                    <div className=" container mt-4 ">
                        <div className="row ">
                            <div className="col-sm-3"></div>
                            <div className="col-sm-6 addgames" >
                                <h2 className="text-center text-light mt-4 ">ADD GAMES</h2>
                                <form className="text-center px-5" >
                                    <input className="form-control mt-5" type="text" name="Gamename" placeholder="Enter Game name" onChange={(e) => setName(e.target.value)} />
                                    <input className="form-control mt-5 " type="text" onChange={(e) => setImage(e.target.value)} name="image" placeholder='Enter Game Image link' />
                                    <input className="form-control mt-5 " type="text" value={gfimage} onChange={(e) => setFimage(e.target.value)} name="image" placeholder='Enter Game Image link' />
                                    <input className="form-control mt-5 " type="text" value={gvideo} onChange={(e) => setVideo(e.target.value)} name="video" placeholder='Enter Game video link' />
                                    <input className="form-control mt-5 " type="text" value={othername} onDoubleClick={(e) => setOthername(...othername, e.target.value)} name="othername" placeholder='Enter other name' />
                                    <textarea className="form-control mt-5" type="text" onChange={(e) => setDes(e.target.value)} placeholder="Enter Game describtion" name="Gdes" />
                                    <select name="Gcat" required onChange={(e) => setCat(e.target.value)} className='form-select mt-5' >
                                        <option defaultChecked >Select Category</option>
                                        <option value="Roleplay" >Roleplay</option>
                                        <option value="Simulation">Simulation</option>
                                        <option value="Sports">Sports</option> </select>
                                    <select name="Gtrend" required onChange={(e) => setTrend(e.target.value)} className='form-select mt-5' >
                                        <option defaultChecked >Select Trending</option>
                                        <option value="Not Trending" >Not Trending</option>
                                        <option value="Trending">Trending</option>
                                    </select>
                                    <input type="text" className="form-control mt-5" placeholder='Download Link here ' required name='glink' onChange={(e) => setLink(e.target.value)} />
                                    <button className="btn btn-primary mt-5 mb-3 btn-lg px-5" onClick={addgame}>Submit</button>
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
