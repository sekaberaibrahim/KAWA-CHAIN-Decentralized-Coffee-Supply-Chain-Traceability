import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWeb3, ROLES } from "../lib/web3.jsx";
import { ipfsAdd } from "../lib/ipfs.js";

const ROLE_INFO = {
  Farmer: { fn: "registerFarmer", blurb: "You grow and harvest coffee. You can register batches and mint their certificates." },
  Processor: { fn: "registerProcessor", blurb: "You run a washing station or mill. You take custody of harvested batches." },
  Exporter: { fn: "registerExporter", blurb: "You prepare processed coffee for international sale and shipping." },
  Buyer: { fn: "registerBuyer", blurb: "You purchase export-ready batches through escrow and confirm delivery." },
};

export default function Register() {
  const { account, contracts, connect, role, refresh } = useWeb3();
  const nav = useNavigate();
  const [pick, setPick] = useState("Farmer");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!account) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Connect first</h3>
        <p>Registration writes your identity to the blockchain, so you need a connected MetaMask wallet.</p>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={connect}>Connect MetaMask</button>
      </div>
    );
  }

  if (role > 0) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Already registered</h3>
        <p>This wallet is registered as a <strong>{ROLES[role]}</strong>. One wallet holds one role.</p>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => nav("/dashboard")}>
          Go to your dashboard
        </button>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true);
    try {
      // Store supporting documents/details on (mock) IPFS
      const uri = await ipfsAdd({
        type: "participant-profile",
        role: pick, name, location, notes,
        createdAt: new Date().toISOString(),
      });
      const tx = await contracts.registry[ROLE_INFO[pick].fn](name, location, uri);
      await tx.wait();
      await refresh();
      nav("/dashboard");
    } catch (e2) {
      setErr(e2.reason || e2.shortMessage || e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">Join the chain</div>
        <h2>Register your role</h2>
      </div>
      <div className="panel-grid grid-2">
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={pick} onChange={(e) => setPick(e.target.value)}>
              {Object.keys(ROLE_INFO).map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="name">Name / cooperative</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="e.g. Kopakama Cooperative" />
          </div>
          <div className="field">
            <label htmlFor="loc">Location</label>
            <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)}
                   placeholder="e.g. Nyamasheke, Western Province" />
          </div>
          <div className="field">
            <label htmlFor="notes">Profile notes (stored on IPFS)</label>
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Certifications, capacity, contact details…" />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Registering on-chain…" : `Register as ${pick}`}
          </button>
          {err && <p className="error-text" role="alert">{err}</p>}
        </form>
        <div className="card">
          <h3>{pick}</h3>
          <p>{ROLE_INFO[pick].blurb}</p>
          <p className="muted" style={{ marginTop: "1rem" }}>
            Registration sends one transaction from your wallet
            ({account.slice(0, 8)}…). Your profile document is stored via IPFS
            and only its content hash goes on-chain.
          </p>
        </div>
      </div>
    </>
  );
}
