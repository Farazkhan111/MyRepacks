import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [username, setUser] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("admin");
    if (user) {
      setUser(user);
    } else {
      nav("/");
    }
  }, [nav]);

  return (
    <>
      <Sidebar />

      <div className="main-content dashboard">
        <div className="welcome-card">
          <h1>Welcome 👋</h1>
          <h2>{username}</h2>
          <p>Manage your games from the sidebar</p>

          
        </div>
      </div>
    </>
  );
}