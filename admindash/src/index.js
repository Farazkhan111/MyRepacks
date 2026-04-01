import React from 'react';
import ReactDOM from 'react-dom/client';
import "./Style/Style.css"

import '../node_modules/bootstrap/dist/css/bootstrap.min.css'

import Login from './admindash/Login/Login';
import Browser from './admindash/Browser';
// import 'bootstrap/dist/css/bootstrap.min.css'
// import 'bootstrap/dist/js/bootstrap.bundle.min.js'
// import 'bootstrap-icons/font/bootstrap-icons.css'




const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
   
    <Browser/> 
);