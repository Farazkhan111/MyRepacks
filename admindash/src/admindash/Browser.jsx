import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login/Login';
import Dashboard from './dashboard/Dashboard';
import AddGames from './dashboard/AddGames';
import ShowGames from './dashboard/ShowGames';
import Edit from './dashboard/Edit';
export default function Browser() {
  return (
     <BrowserRouter>
      <Routes>
        <Route>
          <Route index element={<Login />}/>
          <Route path='/dashboard' element={<Dashboard/>} />
          <Route path='/add'element={<AddGames/>}/>
          <Route path='/show' element={<ShowGames/>}/>
          <Route path='/edit' element={<Edit/>}/>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

