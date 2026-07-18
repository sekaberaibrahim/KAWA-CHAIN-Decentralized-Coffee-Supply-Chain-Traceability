import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "./lib/web3.jsx";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import BatchDetail from "./pages/BatchDetail.jsx";
import Verify from "./pages/Verify.jsx";
import Analytics from "./pages/Analytics.jsx";
import Tracker from "./pages/Tracker.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Web3Provider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/batch/:id" element={<BatchDetail />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/verify/:id" element={<Verify />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
        </Routes>
      </HashRouter>
    </Web3Provider>
  </React.StrictMode>
);
