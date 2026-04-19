import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import url from "../dashboard/url/url";

export default function Login() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  function log() {
    if (!username || !password) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);

    axios
      .post( url+"/login", { username, password })
      .then((result) => {
        if (result.data === "UserNot") {
          alert("User not found");
        } else if (result.data === "PassNot") {
          alert("Incorrect password");
        } else {
          localStorage.setItem("admin", result.data.username);
          nav("/dashboard");
        }
      })
      .catch(() => alert("Server error"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="blogin">
      <div className="login-card">
        <h2 className="title">Admin Login</h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUser(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
        />

        <button onClick={log} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}