import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import url from './url';
export default function Popularp() {
  const [tgame, setData] = useState([]);
  const nav=useNavigate();
  useEffect(() => {
    // setData(Trendgames);
    axios.post(url+"/showtrend")
      .then((res) => {
        console.log(res.data);
        setData(res.data);
      })
  })
  function showgame(id){
        // alert(id);
        nav("/gamepage",{state:id});
    }
  // console.log(tgame);
  return (
    <>
      <div className="tdiv1 text-center">
        <h1 className='th1 text-light '><span className='text-info'>Trending</span> Games</h1>
      </div>
      <div className='trending '>
        <div className='tgames container justify-content-center '>
          <div className="row tcont ">
            {
              tgame.map((games, index) => (
                games.trending === "Trending" ?
                  <>
                    <div className="  col-sm-6 col-lg-3 col-md-4 text-center pgame  my-3 neon-card-container "  style={{ cursor: 'pointer' }}  onClick={()=>showgame(games._id)}>
                      <div className="trefl" style={{ backgroundImage: `url(${games.fimage})` }}></div>
                      <div className=" text-light game-card  ">
                        <div className="card-image-container">

                        <img src={games.fimage} className="img1card card-img-top cardimg "  alt="" />
                        </div>
                        <div className="card-content  text-center">
                          <h6 className='game-title ttitle'>{games.name}</h6>
                        </div>
                      </div>
                    </div>
                  </>
                  :
                  <>
                  </>
              ))
            }
          </div>
        </div>
      </div>
    </>
  )
}
