import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
export default function Latest() {
  const [lgame, setData] = useState([]);
  const nav=useNavigate();
  useEffect(() => {
    axios.post("http://localhost:5000/showtrend")
    .then((res)=>{
      // console.log(res.data.reverse());
      const rev = res.data.reverse();
      setData(rev);
    })
  },[])
function showgame(id){
        // alert(id);
        nav("/gamepage",{state:id});
    }
  var cVal = lgame.length / 3;
  console.log(cVal)
  return (
    <>
      <div className='ldiv1 text-center'>
        <h1 className='lh1 text-light'><span className='text-info'>Latest</span> Games</h1>
      </div>
      <div className="latest container-fluid justify-content-center">
        <div className="lgames container justify-content-center">
          <div className="row ">

            <div className="col-12 col-sm-6 col-md-4 col-lg-4 justify-content-center">
              <div className="card lcard ">

              {
                lgame.map((games, index) => (
                  
                  index < 4 ?
                  <div className="card my-3 lgcard " style={{ cursor: 'pointer' }}  onClick={()=>showgame(games._id)}>
                    <div className="contanier-fluid">
                      <div className="row ">

                    <div className="col-4 col-sm-4 col-md-5  col-lg-2   ">

                      <img src={games.image} alt="" className='rounded' height={"120px"} width={"100px"} />
                    </div>
                    <div className="col-8 col-sm-8 col-md-7   col-lg-10  text-center  ">
                      <h5 className=' text-light fs-6 mt-4 pt-3 '>{games.name}</h5>
                    </div>
                      
                    </div>
                      </div>

                    </div>
                    : <></>
                    
                  ))
                }
                </div>
            </div>
            <div className="col-12 col-sm-6 col-md-4 col-lg-4  justify-content-center">
                <div className="card lcard">

              {
                lgame.map((games, index) => (


                  index > 3 && index < 8 ?
                    <div className="card my-3 lgcard" style={{ cursor: 'pointer' }}  onClick={()=>showgame(games._id)}>
                      <div className="contanier-fluid">
                        <div className="row  ">

                      <div className="col-4 col-sm-4 col-md-5 col-lg-2   ">

                      <img src={games.image} alt="" className='rounded' height={"120px"} width={"100px"} />
                      </div>
                      <div className="col-8 col-sm-8 col-md-7   col-lg-10  text-center  ">
                      <h5 className=' text-light fs-6 mt-4 pt-3 '>{games.name}</h5>
                    </div>
                        
                      </div>
                        </div>
                    </div>

                    : <></>
                ))
              }
              </div>
            </div>
            <div className="col-12 col-sm-12 col-md-4 col-lg-4  justify-content-center">
                <div className="card lcard">

              {
                lgame.map((games, index) => (


                  index > 7 && index < 12 ?
                    <div className="card my-3 lgcard" style={{ cursor: 'pointer' }}  onClick={()=>showgame(games._id)}>
                      <div className="contanier-fluid">
                        <div className="row ">

                      <div className="col-4 col-sm-4 col-md-5 col-lg-2   ">

                      <img src={games.image} alt="" className='rounded' height={"120px"} width={"100px"} />
                      </div>
                      <div className="col-8 col-sm-8 col-md-7   col-lg-10  text-center  ">
                      <h5 className=' text-light fs-6 mt-4 pt-3 '>{games.name}</h5>
                    </div>
                      
                      </div>
                        </div>
                    </div>

                    : <></>
                ))
              }
              </div>
            </div>




          </div>
        </div>
      </div>
    </>
  )
}
