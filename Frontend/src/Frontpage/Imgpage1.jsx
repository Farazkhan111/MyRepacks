import React from 'react'
import { Link } from 'react-router-dom'

export default function Imgpage1() {
  return (
    <>
    <div className="sec1">
     
        <div className="  container-fluid">
          <div className="row ">
            <div className="col-sm-3"></div>
            <div className="sec1s1 col-sm-6">
               <h6 className='fs-5'>Welcome To <span className='text-info'>MyGaMeS</span> </h6>
           <h1 className='fs-2'><span className='text-info'>Browse</span> Our Popular Games Here</h1>
           <Link to={"/collection"} className='btn btn-primary btn-lg mt-3'>Browse Now</Link>
            </div>
            <div className="col-sm-3"></div>
          </div>
        </div>
    </div>
    </>
  )
}
