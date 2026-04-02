import React, { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const [username,setUser]=useState();
    const nav=useNavigate();
    useEffect(()=>{
      const user = localStorage.getItem("admin");
      if(user){
        setUser(user);
      }
      else{
        nav("/");
      }
    },[nav])
  return (
    <>
        {/* Sidebar + Navbar */}
        <Sidebar />

        {/* Main Content */}
        <div className="main-content addcontainer d-flex align-items-center justify-content-center">

            <h1 className="dashh1 text-center">
                Welcome {username}
            </h1>

        </div>
    </>
);
}
