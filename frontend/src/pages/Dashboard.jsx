import { useState } from "react";
import { Link } from "react-router-dom";
import { parseEther, formatEther } from "ethers";
import { useWeb3, ROLES, STAGES } from "../lib/web3.jsx";
import { useBatches, loadDeal, loadPrice } from "../lib/data.js";
import { ipfsAdd } from "../lib/ipfs.js";
import { StageBadge } from "../components/Shared.jsx";
import { useEffect } from "react";

export default function Dashboard() {
  const { account, role, participant, connect } = useWeb3();
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  if (!account) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Your dashboard lives behind your wallet</h3>
        <p>Connect MetaMask to see the batches you own and the actions your role allows.</p>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={connect}>Connect MetaMask</button>
      </div>
    );
  }
  if (role === 0) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>No role yet</h3>
        <p>This wallet isn't registered. Pick a role to join the chain.</p>
        <Link className="btn btn-primary" style={{ marginTop: "1rem" }} to="/register">Register</Link>
      </div>
    );
  }

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">{ROLES[role]} dashboard</div>
        <h2>{participant?.name || "Your operation"}</h2>
        {participant?.location && <p className="muted">{participant.location}</p>}
      </div>
      {role === 1 && <FarmerView refreshKey={refreshKey} bump={bump} />}
      {role === 2 && <ProcessorView refreshKey={refreshKey} bump={bump} />}
      {role === 3 && <ExporterView refreshKey={refreshKey} bump={bump} />}
      {role === 4 && <BuyerView refreshKey={refreshKey} bump={bump} />}
    </>
  );
}

/* ---------------- shared table of owned batches ---------------- */
function BatchTable({ rows, names, actions }) {
  if (rows.length === 0) return <p className="muted">No batches here yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Origin</th><th>Variety</th><th>Weight</th>
            <th>Score</th><th>Stage</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.id}</td>
              <td>{b.origin}</td>
              <td>{b.variety}</td>
              <td>{b.weightKg.toLocaleString()} kg</td>
              <td>{b.qualityScore}</td>
              <td><StageBadge stage={b.stage} /></td>
              <td style={{ whiteSpace: "nowrap" }}>
                <Link className="btn btn-outline btn-sm" to={`/batch/${b.id}`}>Open</Link>
                {actions && actions(b)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- transfer form (used by farmer/processor) -------------- */
function TransferControl({ batch, nextRoleLabel, bump }) {
  const { contracts } = useWeb3();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setErr(""); setBusy(true);
    try {
      const tx = await contracts.nft.transferCustody(batch.id, to.trim(), note);
      await tx.wait();
      setOpen(false); setTo(""); setNote("");
      bump();
    } catch (e) {
      setErr(e.reason || e.shortMessage || e.message);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginLeft: 6 }} onClick={() => setOpen(true)}>
        Hand to {nextRoleLabel}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 8, minWidth: 260 }}>
      <div className="field">
        <label>{nextRoleLabel} wallet address</label>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
      </div>
      <div className="field">
        <label>Shipment note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Truck RW-341 to Gakenke station" />
      </div>
      <button className="btn btn-primary btn-sm" onClick={go} disabled={busy || !to}>
        {busy ? "Transferring…" : "Confirm transfer"}
      </button>{" "}
      <button className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}

/* ============================ FARMER ============================ */
function FarmerView({ refreshKey, bump }) {
  const { account, contracts } = useWeb3();
  const { batches, names, loading } = useBatches(refreshKey);
  const mine = batches.filter((b) => b.owner === account.toLowerCase());
  const registered = batches.filter((b) => b.farmer === account.toLowerCase());

  const [f, setF] = useState({ origin: "", variety: "", weightKg: "", harvestYear: new Date().getFullYear(), qualityScore: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function registerBatch(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const docURI = await ipfsAdd({
        type: "coffee-batch",
        ...f, createdAt: new Date().toISOString(),
      });
      const tx = await contracts.nft.registerBatch(
        f.origin, f.variety,
        Number(f.weightKg), Number(f.harvestYear), Number(f.qualityScore || 0),
        docURI
      );
      await tx.wait();
      setF({ origin: "", variety: "", weightKg: "", harvestYear: new Date().getFullYear(), qualityScore: "", notes: "" });
      bump();
    } catch (e2) {
      setErr(e2.reason || e2.shortMessage || e2.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="panel-grid grid-2">
      <form className="card" onSubmit={registerBatch}>
        <h3>Register a new harvest</h3>
        <div className="field"><label>Origin (farm / washing station, region)</label>
          <input value={f.origin} onChange={set("origin")} placeholder="Kopakama, Lot 7 — Rutsiro" required /></div>
        <div className="field"><label>Variety</label>
          <input value={f.variety} onChange={set("variety")} placeholder="Red Bourbon" required /></div>
        <div className="panel-grid grid-3">
          <div className="field"><label>Weight (kg)</label>
            <input type="number" min="1" value={f.weightKg} onChange={set("weightKg")} required /></div>
          <div className="field"><label>Harvest year</label>
            <input type="number" value={f.harvestYear} onChange={set("harvestYear")} required /></div>
          <div className="field"><label>Cupping score</label>
            <input type="number" min="0" max="100" value={f.qualityScore} onChange={set("qualityScore")} /></div>
        </div>
        <div className="field"><label>Notes (stored on IPFS)</label>
          <textarea rows={2} value={f.notes} onChange={set("notes")} placeholder="Altitude, drying method, lot details…" /></div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Minting certificate…" : "Mint batch certificate (NFT)"}
        </button>
        {err && <p className="error-text">{err}</p>}
      </form>

      <div>
        <div className="card">
          <h3>Batches in your custody</h3>
          {loading ? <p className="muted">Loading…</p> : (
            <BatchTable rows={mine} names={names}
              actions={(b) => b.stage === 0 && <TransferControl batch={b} nextRoleLabel="processor" bump={bump} />} />
          )}
        </div>
        <div className="card">
          <h3>Everything you've ever registered</h3>
          {loading ? <p className="muted">Loading…</p> : <BatchTable rows={registered} names={names} />}
        </div>
      </div>
    </div>
  );
}

/* ============================ PROCESSOR ============================ */
function ProcessorView({ refreshKey, bump }) {
  const { account } = useWeb3();
  const { batches, names, loading } = useBatches(refreshKey);
  const mine = batches.filter((b) => b.owner === account.toLowerCase());
  return (
    <div className="card">
      <h3>Batches at your station</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        When milling and grading are done, hand the batch to a registered exporter.
      </p>
      {loading ? <p className="muted">Loading…</p> : (
        <BatchTable rows={mine} names={names}
          actions={(b) => b.stage === 1 && <TransferControl batch={b} nextRoleLabel="exporter" bump={bump} />} />
      )}
    </div>
  );
}

/* ============================ EXPORTER ============================ */
function ExporterView({ refreshKey, bump }) {
  const { account, contracts } = useWeb3();
  const { batches, names, loading } = useBatches(refreshKey);
  const mine = batches.filter((b) => b.owner === account.toLowerCase());
  const [deals, setDeals] = useState({});
  const [price, setPrice] = useState(null);

  useEffect(() => {
    (async () => {
      setPrice(await loadPrice().catch(() => null));
      const d = {};
      for (const b of mine) d[b.id] = await loadDeal(b.id).catch(() => null);
      setDeals(d);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, mine.length]);

  async function cancel(id) {
    const tx = await contracts.escrow.cancelDeal(id);
    await tx.wait();
    bump();
  }

  return (
    <>
      {price != null && (
        <div className="notice" style={{ marginBottom: "1.25rem" }}>
          Oracle reference price: <strong>${price.toFixed(2)} / kg</strong> green coffee.
        </div>
      )}
      <div className="card">
        <h3>Export-ready inventory</h3>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Buyers fund escrow against a batch you own. When they confirm delivery,
          the certificate transfers and the payment releases to you automatically.
        </p>
        {loading ? <p className="muted">Loading…</p> : (
          <BatchTable rows={mine} names={names}
            actions={(b) => {
              const d = deals[b.id];
              if (d && d.state === 1) {
                return (
                  <span style={{ marginLeft: 6 }}>
                    <span className="badge badge-exported">Escrow: {formatEther(d.amount)} ETH funded</span>{" "}
                    <button className="btn btn-outline btn-sm" onClick={() => cancel(b.id)}>Cancel deal</button>
                  </span>
                );
              }
              if (b.stage === 2) return <span className="badge badge-processed" style={{ marginLeft: 6 }}>Awaiting buyer</span>;
              return null;
            }} />
        )}
      </div>
    </>
  );
}

/* ============================ BUYER ============================ */
function BuyerView({ refreshKey, bump }) {
  const { account, contracts } = useWeb3();
  const { batches, names, loading } = useBatches(refreshKey);
  const market = batches.filter((b) => b.stage === 2 && b.owner !== account.toLowerCase());
  const mine = batches.filter((b) => b.owner === account.toLowerCase());
  const [deals, setDeals] = useState({});
  const [price, setPrice] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setPrice(await loadPrice().catch(() => null));
      const d = {};
      for (const b of batches) d[b.id] = await loadDeal(b.id).catch(() => null);
      setDeals(d);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, batches.length]);

  async function fund(b) {
    setErr(""); setBusyId(b.id);
    try {
      const eth = amounts[b.id];
      const tx = await contracts.escrow.fundDeal(b.id, { value: parseEther(eth || "0") });
      await tx.wait();
      bump();
    } catch (e) { setErr(e.reason || e.shortMessage || e.message); }
    finally { setBusyId(null); }
  }

  async function confirm(b) {
    setErr(""); setBusyId(b.id);
    try {
      const tx = await contracts.escrow.confirmDelivery(b.id, "Delivery confirmed by buyer");
      await tx.wait();
      bump();
    } catch (e) { setErr(e.reason || e.shortMessage || e.message); }
    finally { setBusyId(null); }
  }

  return (
    <>
      {price != null && (
        <div className="notice" style={{ marginBottom: "1.25rem" }}>
          Oracle reference price: <strong>${price.toFixed(2)} / kg</strong> — use it to judge an offer.
        </div>
      )}
      {err && <p className="error-text" role="alert">{err}</p>}
      <div className="card">
        <h3>Market — export-ready batches</h3>
        {loading ? <p className="muted">Loading…</p> : market.length === 0 ? (
          <p className="muted">Nothing listed right now. Batches appear here when exporters hold them.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Origin</th><th>Variety</th><th>Weight</th><th>Score</th>
                <th>Exporter</th><th>Escrow</th>
              </tr></thead>
              <tbody>
                {market.map((b) => {
                  const d = deals[b.id];
                  const funded = d && d.state === 1;
                  const iFunded = funded && d.buyer.toLowerCase() === account.toLowerCase();
                  return (
                    <tr key={b.id}>
                      <td className="mono">{b.id}</td>
                      <td><Link to={`/batch/${b.id}`}>{b.origin}</Link></td>
                      <td>{b.variety}</td>
                      <td>{b.weightKg.toLocaleString()} kg</td>
                      <td>{b.qualityScore}</td>
                      <td>{names[b.owner] || b.owner.slice(0, 8) + "…"}</td>
                      <td style={{ minWidth: 230 }}>
                        {iFunded ? (
                          <button className="btn btn-primary btn-sm" disabled={busyId === b.id}
                                  onClick={() => confirm(b)}>
                            {busyId === b.id ? "Settling…" : `Confirm delivery (${formatEther(d.amount)} ETH held)`}
                          </button>
                        ) : funded ? (
                          <span className="badge badge-exported">Escrow funded by another buyer</span>
                        ) : (
                          <span style={{ display: "flex", gap: 6 }}>
                            <input style={{ width: 90, padding: "0.3rem 0.5rem", border: "1px solid var(--line)", borderRadius: 3 }}
                                   placeholder="ETH" value={amounts[b.id] || ""}
                                   onChange={(e) => setAmounts({ ...amounts, [b.id]: e.target.value })} />
                            <button className="btn btn-primary btn-sm" disabled={busyId === b.id || !amounts[b.id]}
                                    onClick={() => fund(b)}>
                              {busyId === b.id ? "Funding…" : "Fund escrow"}
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <h3>Batches you own</h3>
        {loading ? <p className="muted">Loading…</p> : <BatchTable rows={mine} names={names} />}
      </div>
    </>
  );
}
