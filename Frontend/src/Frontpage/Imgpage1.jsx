import React from 'react'
import { Link } from 'react-router-dom'

export default function Imgpage1() {
  return (
    <div className="sec1 d-flex align-items-center justify-content-center">
      <div className="container">
        <div className="row justify-content-center text-center">
          <div className="col-lg-8 sec1s1">
            <h6 className='welcome-text'>
              Welcome To <span className='text-info'>MyRePacks</span>
            </h6>

            <h1 className='main-heading'>
              <span className='text-info'>Browse</span> Our Popular Games
            </h1>

            <p className='sub-text'>
              Discover top repacked games with fast downloads and best performance.
            </p>

            <Link to="/collection" className='btn browse-btn mt-4'>
              Browse Now 🚀
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}