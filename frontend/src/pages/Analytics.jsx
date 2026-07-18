import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useBatches, loadPrice } from "../lib/data.js";
import { readContracts, STAGES, short } from "../lib/web3.jsx";
import { formatEther } from "ethers";

const STAGE_COLORS = ["#7d6f5f", "#4a5d3a", "#c9a24b", "#b4472e"];

export default function Analytics() {
  const { batches, names, loading, err } = useBatches();
  const [price, setPrice] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    (async () => {
      setPrice(await loadPrice().catch(() => null));
      // On-chain event log: pull recent contract events (free local RPC)
      try {
        const c = readContracts();
        const out = [];
        const push = (arr, kind, fmt) => arr.forEach((e) => out.push({
          kind, block: e.blockNumber, text: fmt(e.args),
        }));
        push(await c.nft.queryFilter(c.nft.filters.BatchRegistered(), 0), "Batch",
          (a) => `Batch #${a.tokenId} registered — ${a.origin} (${a.weightKg} kg)`);
        push(await c.nft.queryFilter(c.nft.filters.CustodyTransferred(), 0), "Custody",
          (a) => `Batch #${a.tokenId}: ${short(a.from)} → ${short(a.to)} (${STAGES[Number(a.stageAfter)]})`);
        push(await c.escrow.queryFilter(c.escrow.filters.DealFunded(), 0), "Escrow",
          (a) => `Deal on batch #${a.tokenId} funded: ${formatEther(a.amount)} ETH`);
        push(await c.escrow.queryFilter(c.escrow.filters.DealReleased(), 0), "Escrow",
          (a) => `Deal on batch #${a.tokenId} released: ${formatEther(a.amount)} ETH to seller`);
        push(await c.registry.queryFilter(c.registry.filters.ParticipantRegistered(), 0), "Registry",
          (a) => `${a.name} registered (${["-","Farmer","Processor","Exporter","Buyer"][Number(a.role)]})`);
        out.sort((x, y) => y.block - x.block);
        setEvents(out.slice(0, 30));
      } catch { /* chain unreachable */ }
    })();
  }, []);

  const totalKg = batches.reduce((s, b) => s + b.weightKg, 0);
  const avgScore = batches.length
    ? (batches.reduce((s, b) => s + b.qualityScore, 0) / batches.length).toFixed(1)
    : "—";

  const byStage = STAGES.map((s, i) => ({
    name: s, value: batches.filter((b) => b.stage === i).length,
  }));
  const byVariety = Object.entries(
    batches.reduce((m, b) => ((m[b.variety] = (m[b.variety] || 0) + b.weightKg), m), {})
  ).map(([name, kg]) => ({ name, kg }));

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">Analytics</div>
        <h2>The chain at a glance</h2>
      </div>
      {err && <div className="notice">{err}</div>}

      <div className="panel-grid grid-4" style={{ marginBottom: "1.25rem" }}>
        <div className="stat"><div className="num">{batches.length}</div><div className="lbl">Batches on-chain</div></div>
        <div className="stat"><div className="num">{totalKg.toLocaleString()}</div><div className="lbl">Total kg tracked</div></div>
        <div className="stat"><div className="num">{avgScore}</div><div className="lbl">Avg cupping score</div></div>
        <div className="stat"><div className="num">{price != null ? `$${price.toFixed(2)}` : "—"}</div><div className="lbl">Oracle price / kg</div></div>
      </div>

      <div className="panel-grid grid-2">
        <div className="card">
          <h3>Batches by stage</h3>
          {loading ? <p className="muted">Loading…</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byStage} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byStage.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3>Volume by variety (kg)</h3>
          {loading ? <p className="muted">Loading…</p> : byVariety.length === 0 ? (
            <p className="muted">No batches yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byVariety}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="kg" fill="#b4472e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Blockchain event log</h3>
        {events.length === 0 ? <p className="muted">No events yet — or the local chain isn't running.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Block</th><th>Type</th><th>Event</th></tr></thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td className="mono">{e.block}</td>
                    <td><span className="badge badge-role">{e.kind}</span></td>
                    <td>{e.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
