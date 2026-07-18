import { Outlet, NavLink, Link } from "react-router-dom";
import { useWeb3, short, ROLES } from "../lib/web3.jsx";

export default function Layout() {
  const { account, role, participant, connect, disconnect, connecting, error } = useWeb3();

  return (
    <div className="shell">
      <nav className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">KAWA<span>·</span>CHAIN</Link>
          <div className="nav-links">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/tracker">Shipment tracker</NavLink>
            <NavLink to="/verify">Verify a batch</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            {account ? (
              <button className="btn btn-outline btn-sm" onClick={disconnect} title={account}>
                {participant?.name ? `${participant.name} · ` : ""}
                {ROLES[role] !== "None" ? ROLES[role] : short(account)}
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect MetaMask"}
              </button>
            )}
          </div>
        </div>
      </nav>
      {error && (
        <div className="container" style={{ paddingTop: "0.8rem" }}>
          <div className="notice" role="alert">{error}</div>
        </div>
      )}
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="site">
        <div className="container">
          KAWA·CHAIN — decentralized traceability for Rwandan coffee · runs on a free local blockchain
        </div>
      </footer>
    </div>
  );
}
