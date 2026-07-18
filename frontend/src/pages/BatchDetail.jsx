import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { readContracts, STAGES, short } from "../lib/web3.jsx";
import { loadShipments, loadDeal } from "../lib/data.js";
import { ipfsGet, shortCid } from "../lib/ipfs.js";
import { StageBadge, ProvenanceTimeline } from "../components/Shared.jsx";
import { formatEther } from "ethers";

export default function BatchDetail() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [owner, setOwner] = useState("");
  const [shipments, setShipments] = useState([]);
  const [names, setNames] = useState({});
  const [deal, setDeal] = useState(null);
  const [err, setErr] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const c = readContracts();
        const [b, o, s] = await Promise.all([
          c.nft.getBatch(id), c.nft.ownerOf(id), loadShipments(id),
        ]);
        setBatch({
          origin: b.origin, variety: b.variety,
          weightKg: Number(b.weightKg), harvestYear: Number(b.harvestYear),
          qualityScore: Number(b.qualityScore), stage: Number(b.stage),
          docURI: b.docURI, createdAt: Number(b.createdAt), farmer: b.farmer,
        });
        setOwner(o);
        setShipments(s);
        setDeal(await loadDeal(id).catch(() => null));
        const n = {};
        const totalP = Number(await c.registry.totalParticipants());
        for (let i = 0; i < totalP; i++) {
          const addr = (await c.registry.participantAt(i)).toLowerCase();
          n[addr] = (await c.registry.getParticipant(addr)).name;
        }
        setNames(n);
      } catch {
        setErr(`Batch #${id} was not found on-chain.`);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (batch && canvasRef.current) {
      const url = `${window.location.origin}${window.location.pathname}#/verify/${id}`;
      QRCode.toCanvas(canvasRef.current, url, { width: 190, margin: 1, color: { dark: "#2b1d14", light: "#fffdf9" } });
    }
  }, [batch, id]);

  if (err) return <div className="card"><h3>Not found</h3><p>{err}</p></div>;
  if (!batch) return <p className="muted">Loading batch #{id}…</p>;

  const doc = ipfsGet(batch.docURI);

  return (
    <>
      <div className="section-head">
        <div className="eyebrow">Batch certificate · token #{id}</div>
        <h2>{batch.origin}</h2>
        <p style={{ marginTop: 4 }}><StageBadge stage={batch.stage} /></p>
      </div>

      <div className="panel-grid grid-2">
        <div>
          <div className="card">
            <h3>Certificate</h3>
            <div className="table-wrap"><table><tbody>
              <tr><td className="muted">Variety</td><td>{batch.variety}</td></tr>
              <tr><td className="muted">Weight</td><td>{batch.weightKg.toLocaleString()} kg</td></tr>
              <tr><td className="muted">Harvest year</td><td>{batch.harvestYear}</td></tr>
              <tr><td className="muted">Cupping score</td><td>{batch.qualityScore} / 100</td></tr>
              <tr><td className="muted">Registered by</td><td>{names[batch.farmer.toLowerCase()] || short(batch.farmer)} <span className="mono muted">({short(batch.farmer)})</span></td></tr>
              <tr><td className="muted">Current holder</td><td>{names[owner.toLowerCase()] || short(owner)} <span className="mono muted">({short(owner)})</span></td></tr>
              <tr><td className="muted">Documents (IPFS)</td><td className="mono">{shortCid(batch.docURI)}</td></tr>
              <tr><td className="muted">Created</td><td>{new Date(batch.createdAt * 1000).toLocaleString()}</td></tr>
            </tbody></table></div>
          </div>

          {doc && (
            <div className="card">
              <h3>IPFS document</h3>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: "0.82rem", background: "var(--parchment)", padding: "0.9rem", borderRadius: 4 }}>
                {JSON.stringify(doc, null, 2)}
              </pre>
            </div>
          )}

          {deal && deal.state > 0 && (
            <div className="card">
              <h3>Escrow</h3>
              <p>
                {["", "Funded and locked", "Released to seller", "Refunded to buyer"][deal.state]} —{" "}
                <strong>{formatEther(deal.amount)} ETH</strong>
                {deal.deliveryNote && <> · “{deal.deliveryNote}”</>}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3>Provenance</h3>
            <ProvenanceTimeline shipments={shipments} names={names} />
          </div>
          <div className="card">
            <h3>QR verification</h3>
            <div className="qr-box">
              <canvas ref={canvasRef} aria-label={`QR code for batch ${id}`} />
              <div>
                <p>Print this code on the export sack. Anyone who scans it lands on
                the public verification page for this exact batch — no wallet needed.</p>
                <Link className="btn btn-outline btn-sm" style={{ marginTop: 10 }} to={`/verify/${id}`}>
                  Open public view
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
