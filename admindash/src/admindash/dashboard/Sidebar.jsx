import React from 'react'
import { useNavigate } from 'react-router-dom';
export default function Sidebar() {
    const nav = useNavigate();
    function logout() {
        localStorage.removeItem("admin"); nav("/");
    }
    return (
        <div className="d-flex flex-column flex-shrink-0 p-3 text-bg-dark sidebar" >
            <a href="/dashboard" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
                <svg className="bi pe-none me-2" width="40" height="32" aria-hidden="true"> </svg>
                <span className="fs-4">My Games</span>
            </a> <hr /> <ul className="nav nav-pills flex-column mb-auto"> <li className="nav-item my-3"> <a href="/dashboard" className="nav-link text-light" aria-current="page">
                <svg className="bi pe-none me-2" width="16" height="16" aria-hidden="true"> </svg> Home </a> </li> <li className="nav-item my-3"> <a href="/add" className="nav-link text-light" aria-current="page">
                    <svg className="bi pe-none me-2" width="16" height="16" aria-hidden="true"> </svg> Add Game </a> </li> <li className="nav-item my-3">
                    <a href="/show" className="nav-link text-light" aria-current="page"> <svg className="bi pe-none me-2" width="16" height="16" aria-hidden="true"> </svg> Show Game </a> </li> <li className=" text-light nav-link fs-4 px-5">
                    <button onClick={logout} className="btn btn-danger px-3 text-light text-decoration-none" href="/logout">Logout</button></li> </ul>
        </div>)
}
