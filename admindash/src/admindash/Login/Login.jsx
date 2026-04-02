import axios from 'axios';
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username,setUser]=useState();
    const [password,setPass]=useState();
    const nav=useNavigate();
    function log(){
        axios.post("https://myrepacks.onrender.com/login", {username , password})
        .then((result)=>{
            // console.log(result.data);
           if (result.data === "UserNot") {
                    alert("User not found");
                }
                else if (result.data === "PassNot") {
                    alert("Password not match");
                }
                else{
                    localStorage.setItem("admin",result.data.username);
                    nav("/dashboard");
                }
            
        })
    }
  return (
        <div className="blogin">
        <div class="container-fluid " >
        <div class="row pt-5">
        
            <div class="col-sm-4"></div>
            <div class="col-sm-4  login ">
                
                <h1 class="mt-5 text-center text-info ">Admin Login</h1>
               
               
                     <input type="text" class="form-control my-5" placeholder="Enter Your username" name="username" onChange={(e)=>setUser(e.target.value)} value={username} />
                     <input type="password" class="form-control my-5" placeholder="Enter the password" name="password" onChange={(e)=>setPass(e.target.value)} value={password}/>
                    <button class="btn btn-primary btn-lg px-5 text-light mb-3" onClick={log}>Login</button>
              
                </div>
       
            <div class="col-sm-4"></div>
        </div>
     </div>
 </div>
     
    )
}
