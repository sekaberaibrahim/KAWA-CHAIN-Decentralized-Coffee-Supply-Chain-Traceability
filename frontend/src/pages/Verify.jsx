import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { readContracts, short } from "../lib/web3.jsx";
import { loadShipments } from "../lib/data.js";
import { StageBadge, ProvenanceTimeline } from "../components/Shared.jsx";

export default function Verify() {
  const { id } = useParams();
  const nav = useNavigate();
  const [lookup, setLookup] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  // ---- scanner ----
  async function startScan() {
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (text) => {
          // Accept either a full URL containing /verify/<id> or a bare number
          const m = text.match(/verify\/(\d+)/) || text.match(/^(\d+)$/);
          if (m) {
            stopScan();
            nav(`/verify/${m[1]}`);
          }
        },
        () => {}
      );
    } catch {
      setScanning(false);
    }
  }
  function stopScan() {
    scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
    setScanning(false);
  }
  useEffect(() => () => stopScan(), []);

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">Public verification</div>
        <h2>Trace a batch to its hillside</h2>
        <p className="muted">No wallet, no account — the record is public by design.</p>
      </div>

      {!id && (
        <div className="panel-grid grid-2">
          <div className="card">
            <h3>Scan a QR code</h3>
            <div id="qr-reader" style={{ maxWidth: 340 }} />
            {scanning ? (
              <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={stopScan}>Stop camera</button>
            ) : (
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={startScan}>Start camera</button>
            )}
          </div>
          <div className="card">
            <h3>Or enter a batch number</h3>
            <div className="field">
              <label htmlFor="bn">Batch #</label>
              <input id="bn" value={lookup} onChange={(e) => setLookup(e.target.value)}
                     placeholder="e.g. 1"
                     onKeyDown={(e) => e.key === "Enter" && lookup && nav(`/verify/${lookup}`)} />
            </div>
            <button className="btn btn-primary" disabled={!lookup} onClick={() => nav(`/verify/${lookup}`)}>
              Verify batch
            </button>
          </div>
        </div>
      )}

      {id && <PublicRecord id={id} />}
    </>
  );
}

function PublicRecord({ id }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const c = readContracts();
        const [b, owner, ships] = await Promise.all([
          c.nft.getBatch(id), c.nft.ownerOf(id), loadShipments(id),
        ]);
        const names = {};
        const totalP = Number(await c.registry.totalParticipants());
        for (let i = 0; i < totalP; i++) {
          const addr = (await c.registry.participantAt(i)).toLowerCase();
          names[addr] = (await c.registry.getParticipant(addr)).name;
        }
        setState({
          loading: false, ok: true,
          batch: {
            origin: b.origin, variety: b.variety, weightKg: Number(b.weightKg),
            harvestYear: Number(b.harvestYear), qualityScore: Number(b.qualityScore),
            stage: Number(b.stage), createdAt: Number(b.createdAt),
          },
          owner, ships, names,
        });
      } catch {
        setState({ loading: false, ok: false });
      }
    })();
  }, [id]);

  if (state.loading) return <p className="muted">Checking the chain for batch #{id}…</p>;
  if (!state.ok) {
    return (
      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <h3 style={{ color: "var(--danger)" }}>✕ Not authentic</h3>
        <p>Batch <strong>#{id}</strong> does not exist on this chain. If this number came
        from a product label, the label is not backed by a KAWA·CHAIN certificate.</p>
      </div>
    );
  }

  const { batch, owner, ships, names } = state;
  return (
    <div className="panel-grid grid-2">
      <div className="card" style={{ borderColor: "var(--ok)" }}>
        <h3 style={{ color: "var(--ok)" }}>✓ Authentic batch #{id}</h3>
        <div className="table-wrap"><table><tbody>
          <tr><td className="muted">Origin</td><td>{batch.origin}</td></tr>
          <tr><td className="muted">Variety</td><td>{batch.variety}</td></tr>
          <tr><td className="muted">Weight</td><td>{batch.weightKg.toLocaleString()} kg</td></tr>
          <tr><td className="muted">Harvest year</td><td>{batch.harvestYear}</td></tr>
          <tr><td className="muted">Cupping score</td><td>{batch.qualityScore} / 100</td></tr>
          <tr><td className="muted">Status</td><td><StageBadge stage={batch.stage} /></td></tr>
          <tr><td className="muted">Current holder</td><td>{names[owner.toLowerCase()] || short(owner)}</td></tr>
          <tr><td className="muted">First registered</td><td>{new Date(batch.createdAt * 1000).toLocaleDateString()}</td></tr>
        </tbody></table></div>
      </div>
      <div className="card">
        <h3>Journey</h3>
        <ProvenanceTimeline shipments={ships} names={names} />
      </div>
    </div>
  );
}
