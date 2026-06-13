import React, { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Navbar from './Frontpage/Navbar'
import Home from './Frontpage/Home'
import About from './Frontpage/About'
import Collection from './Frontpage/Collection'
import Gamepage from './Frontpage/Gamepage'
import CyberBackground from './Frontpage/CyberBackground'
import CustomCursor from './Frontpage/CustomCursor'
import LoadingScreen from './Frontpage/LoadingScreen'

export default function Browser() {
  const [loading, setLoading] = useState(true)

  return (
    <BrowserRouter>
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
      <CyberBackground />
      <CustomCursor />
      <Routes>
        <Route path="/" element={<Navbar/>}>
        <Route index element={<Home />}/>
        <Route path='/about' element={<About/>}/>
        <Route path='/collection' element={<Collection/>}/>
        <Route path='/gamepage' element={<Gamepage/>}/>
        </Route>
        
      </Routes>
    </BrowserRouter>
  ) 
}
