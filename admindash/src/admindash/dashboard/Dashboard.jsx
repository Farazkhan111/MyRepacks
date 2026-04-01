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
    })
  return (
    <div className="container-fluid">
        <div className="row">
            <div className="col-sm-2 bg-dark">
                    <Sidebar/>        
            </div> 
             <div className="col-sm-10 addcontainer ">
                
                <h1 className=" dashh1 text-center " >Welcome {username}</h1>
            </div>
        </div>
    </div>
  )
}
