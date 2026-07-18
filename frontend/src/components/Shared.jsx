import { STAGES, short } from "../lib/web3.jsx";

export function StageBadge({ stage }) {
  const s = STAGES[Number(stage)] || "Unknown";
  return <span className={`badge badge-${s.toLowerCase()}`}>{s}</span>;
}

/** The signature element: chain of custody rendered as a provenance line
 *  from hill to cup. Each entry is a real on-chain shipment record. */
export function ProvenanceTimeline({ shipments, names = {} }) {
  if (!shipments || shipments.length === 0) {
    return <p className="muted">No custody records yet.</p>;
  }
  return (
    <div className="timeline">
      {shipments.map((s, i) => {
        const when = new Date(Number(s.timestamp) * 1000);
        const stage = STAGES[Number(s.stageAfter)];
        const from = s.from === "0x0000000000000000000000000000000000000000"
          ? "Origin"
          : names[s.from.toLowerCase()] || short(s.from);
        const to = names[s.to.toLowerCase()] || short(s.to);
        return (
          <div className="tl-item done" key={i}>
            <div className="tl-dot" />
            <div className="tl-stage">{stage}</div>
            <div className="tl-meta">
              {from} → {to} · {when.toLocaleDateString()} {when.toLocaleTimeString()}
            </div>
            {s.note && <div className="tl-note">{s.note}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <p className="muted">{label}</p>;
}
