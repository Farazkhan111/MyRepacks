import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Navbar from './Frontpage/Navbar'
import Home from './Frontpage/Home'
import About from './Frontpage/About'
import Collection from './Frontpage/Collection'
import Gamepage from './Frontpage/Gamepage'
export default function Browser() {
  return (
    <BrowserRouter>
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
