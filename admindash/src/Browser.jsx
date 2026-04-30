import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login       from './admindash/Login/Login';
import Dashboard   from './admindash/dashboard/Dashboard';
import AddGames    from './admindash/dashboard/AddGames';
import ShowGames   from './admindash/dashboard/ShowGames';
import Edit        from './admindash/dashboard/Edit';
import GameScraper from './admindash/dashboard/GameScraper';
import ImportGames from './admindash/dashboard/ImportGames';
import AutoUpdate  from './admindash/dashboard/AutoUpdate';

export default function Browser() {
  return (
    <BrowserRouter>
      <Routes>
        <Route>
          <Route index         element={<Login />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/add"        element={<AddGames />} />
          <Route path="/show"       element={<ShowGames />} />
          <Route path="/edit"       element={<Edit />} />
          <Route path="/scraper"    element={<GameScraper />} />
          <Route path="/import"     element={<ImportGames />} />
          <Route path="/autoupdate" element={<AutoUpdate />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
