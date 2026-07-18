import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBatches, loadShipments } from "../lib/data.js";
import { STAGES } from "../lib/web3.jsx";
import { StageBadge, ProvenanceTimeline } from "../components/Shared.jsx";

export default function Tracker() {
  const { batches, names, loading, err } = useBatches();
  const [openId, setOpenId] = useState(null);
  const [ships, setShips] = useState({});
  const [filter, setFilter] = useState("all");

  async function toggle(id) {
    if (openId === id) { setOpenId(null); return; }
    if (!ships[id]) {
      const s = await loadShipments(id);
      setShips((prev) => ({ ...prev, [id]: s }));
    }
    setOpenId(id);
  }

  const rows = batches.filter((b) => filter === "all" || b.stage === Number(filter));

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">Shipment tracker</div>
        <h2>Where every batch stands</h2>
      </div>

      {err && <div className="notice">{err}</div>}

      <div className="card">
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="stage-filter">Filter by stage</label>
          <select id="stage-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All stages</option>
            {STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </div>

        {loading ? <p className="muted">Loading batches…</p> : rows.length === 0 ? (
          <p className="muted">No batches match. Register a harvest to begin.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Origin</th><th>Variety</th><th>Weight</th>
                <th>Stage</th><th>Progress</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((b) => (
                  <FragmentRow key={b.id} b={b} names={names}
                    open={openId === b.id} ships={ships[b.id]} onToggle={() => toggle(b.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function FragmentRow({ b, names, open, ships, onToggle }) {
  const pct = ((b.stage + 1) / 4) * 100;
  return (
    <>
      <tr>
        <td className="mono">{b.id}</td>
        <td><Link to={`/batch/${b.id}`}>{b.origin}</Link></td>
        <td>{b.variety}</td>
        <td>{b.weightKg.toLocaleString()} kg</td>
        <td><StageBadge stage={b.stage} /></td>
        <td style={{ minWidth: 140 }}>
          <div style={{ background: "var(--parchment-2)", height: 8, borderRadius: 999 }}>
            <div style={{
              width: `${pct}%`, height: 8, borderRadius: 999,
              background: "linear-gradient(90deg, var(--leaf), var(--cherry), var(--gold))",
            }} />
          </div>
        </td>
        <td>
          <button className="btn btn-outline btn-sm" onClick={onToggle}>
            {open ? "Hide trail" : "Show trail"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: "var(--parchment)" }}>
            {ships ? <ProvenanceTimeline shipments={ships} names={names} /> : <p className="muted">Loading…</p>}
          </td>
        </tr>
      )}
    </>
  );
}
