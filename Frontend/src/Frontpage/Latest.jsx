import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import url from './url';

export default function Latest() {
  const [lgame, setData] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    axios.post(url + "/showtrend")
      .then((res) => {
        setData(res.data.reverse());
      })
  }, [])

  function showgame(id) {
    nav("/gamepage", { state: id });
  }

  // ✅ Split into groups of 4 (vertical cards)
  const groups = [];
  for (let i = 0; i < 12; i += 4) {
    groups.push(lgame.slice(i, i + 4));
  }

  return (
    <>
      <div className='ldiv1 text-center'>
        <h1 className='lh1 text-light'>
          <span className='text-info'>Latest</span> Games
        </h1>
      </div>

      <div className="latest container">
        <div className="row justify-content-center">

          {groups.map((group, index) => (
            <div key={index} className="col-12 col-md-6 col-lg-4 d-flex justify-content-center my-4">

              <div className="vertical-card">

                {group.map((game) => (
                  <div
                    key={game._id}
                    className="vertical-item"
                    onClick={() => showgame(game._id)}
                  >
                    <img src={game.image} alt="" />
                    <h6>{game.name}</h6>
                  </div>
                ))}

              </div>

            </div>
          ))}

        </div>
      </div>
    </>
  )
}