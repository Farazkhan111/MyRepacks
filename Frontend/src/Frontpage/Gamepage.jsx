import axios from "axios";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import url from "./url";


export default function Gamepage() {
  const [game, setGames] = useState({});
  const loc = useLocation();
  const idd = loc.state;
  const nav = useNavigate();
  const [com, setComments] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  //  alert(idd);
  useEffect(() => {
    axios.post(url+"/gamepage", { idd })
      .then((res) => {
        // console.log(res.data);
        setGames(res.data);
      })
    axios.post(url+"/comments", { idd })
      .then((res) => {
        // console.log(res.data);

        setComments(res.data);
        // console.log(com);
      })
     
  }, [com, idd])
  useEffect(()=>{
       window.scrollTo(0, 0);
  },[])
  function down() {
    nav(game.link)
  }

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim() || !text.trim()) return;

    const newComment = {
      idd,
      name,
      text,
      date: new Date().toLocaleString(),
    };

    setComments([newComment, ...com]);
    setName("");
    setText("");
    axios.post(url+"/newcomments", { idd, name, text, date: new Date().toLocaleString() });
  };
  function deleteComment(id) {
    axios.post(url+"/cdel", { id })
  };

  return (
    <div className="gamepage container-fluid">
      <div className=" container-fluid "  >
        <div className="gameimgbox" style={{ backgroundImage: `url(${game.fimage})` }}>

        </div>
        <img className="gameimgf" src={game.fimage} alt="" />
      </div>
      <div className="container">

        <div className="row mt-4 align-items-center">

          <div className="col-lg-2 col-md-3 col-4 text-center">
            <img src={game.image} className="mimage" alt={game.name} />
          </div>


          <div className="col-lg-10 col-md-9 col-8">
            <div className="row align-items-center ">
              <div className="col-sm-12">

                <h3 className="text-light gname">{game.name} Repack</h3>
                {/* </div>
              <div className="col-sm-6 "> */}


              </div>
            </div>

          </div>
          <div className=" mt-3">
            <div className="container-fluid text-center">
              <p className="text-light gdesc mt-5 text-center">
                {game.description}
              </p>
              <button onClick={down} style={{ cursor: 'pointer' }} className="btn dbtn px-5 p-2 mt-3 btn-primary text-center">Download</button>
            </div>
          </div>
        </div>
        <div className="comment-section bg-dark p-4 rounded-5">
          <h2>Comments</h2>

          <form onSubmit={handleSubmit} className="comment-form container">
            <input
              type="text"
              placeholder="Your name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <textarea
              placeholder="Write a comment..."
              value={text}
              required
              onChange={(e) => setText(e.target.value)}
            />

            <button className="btn btn-info text-light" type="submit" >Post Comment</button>
          </form>

          <div className="comment-list container bg-dark">
            {com.length === 0 && <p>No comments yet 👀</p>}

            {com.map((c, index) => (
              <div key={c._id} className="comment d-flex align-items-start mb-3 px-3 bg-dark">
                {/* Instagram-style Gradient Avatar (Index) */}
                <div className="position-relative me-3 bg-dark">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                    style={{
                      width: '38px',
                      height: '38px',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                      padding: '2px', // Creates the "ring" effect
                      border: '2px solid #000'
                    }}
                  >
                    <div className="bg-dark rounded-circle w-100 h-100 d-flex align-items-center justify-content-center">
                      {index + 1}
                    </div>
                  </div>
                </div>

                {/* Comment Content */}
                <div className="flex-grow-1 bg-dark">
                  <div className="mb-1">
                    <span className="fw-bold text-light me-2" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                      {c.uname} :-
                    </span>
                    <br />
                    <span className="text-light" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                      {c.ncom}
                    </span>
                  </div>

                  {/* IG Metadata Style */}
                  <div className="d-flex align-items-center gap-3 mt-1" style={{ fontSize: '0.75rem', opacity: '0.7' }}>
                    <span className="text-secondary">{c.postdate}</span>

                    <button
                      className="btn btn-link p-0 text-secondary fw-bold text-decoration-none"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => deleteComment(c._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  )
}
