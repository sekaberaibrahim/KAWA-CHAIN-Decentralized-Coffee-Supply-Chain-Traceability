import { Link } from "react-router-dom";
import { useWeb3 } from "../lib/web3.jsx";

export default function Landing() {
  const { account, connect, role } = useWeb3();

  return (
    <>
      <section className="hero" style={{ margin: "-2.5rem calc(50% - 50vw) 2.5rem", width: "100vw" }}>
        <div className="container">
          <h1>Every bag of coffee carries its <em>whole story</em>.</h1>
          <p className="lead">
            KAWA·CHAIN records the full life of a Rwandan coffee batch on a
            blockchain — from the hillside where it was picked, through the
            washing station and the exporter, to the roaster who buys it.
            Ownership is an NFT certificate. Payment sits in escrow until
            delivery. Anyone can verify a batch with a QR code.
          </p>
          <div className="hero-actions">
            {account ? (
              role > 0
                ? <Link className="btn btn-primary" to="/dashboard">Open your dashboard</Link>
                : <Link className="btn btn-primary" to="/register">Register your role</Link>
            ) : (
              <button className="btn btn-primary" onClick={connect}>Connect MetaMask to begin</button>
            )}
            <Link className="btn btn-outline" to="/verify" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
              Verify a batch
            </Link>
          </div>
          <div className="chain-strip" aria-label="Supply chain stages">
            <span className="hop">FARMER</span><span className="arrow">→</span>
            <span className="hop">PROCESSOR</span><span className="arrow">→</span>
            <span className="hop">EXPORTER</span><span className="arrow">→</span>
            <span className="hop">BUYER</span>
            <span style={{ marginLeft: "0.7rem" }}>each hand-off recorded on-chain</span>
          </div>
        </div>
      </section>

      <div className="section-head">
        <div className="eyebrow">How it works</div>
        <h2>Four roles, one unbroken record</h2>
      </div>
      <div className="panel-grid grid-4">
        <div className="card">
          <h3>Farmers</h3>
          <p>Register a harvest — origin, variety, weight, cupping score — and
          receive an ERC-721 certificate that <strong>is</strong> the batch.
          Documents live on IPFS.</p>
        </div>
        <div className="card">
          <h3>Processors</h3>
          <p>Take custody at the washing station. The transfer is validated
          on-chain: only a registered, active processor can receive a
          harvested batch.</p>
        </div>
        <div className="card">
          <h3>Exporters</h3>
          <p>Receive milled coffee, prepare it for sale, and list it for
          international buyers. Every shipment note is appended to the
          batch's permanent trail.</p>
        </div>
        <div className="card">
          <h3>Buyers</h3>
          <p>Fund an escrow against a specific batch. On confirmed delivery,
          the contract transfers the certificate and releases payment to the
          seller — atomically.</p>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: "3rem" }}>
        <div className="eyebrow">Trust, built in</div>
        <h2>What the chain guarantees</h2>
      </div>
      <div className="panel-grid grid-3">
        <div className="card">
          <h3>Role-based access</h3>
          <p>Enterprise RBAC on-chain. A batch can only move
          Farmer → Processor → Exporter → Buyer. Wrong-order transfers are
          rejected by the contract itself, not by policy.</p>
        </div>
        <div className="card">
          <h3>Escrow payments</h3>
          <p>Buyers never pay into thin air; sellers never ship into silence.
          Funds are locked in a smart contract and released only on
          delivery confirmation — or refunded on cancellation.</p>
        </div>
        <div className="card">
          <h3>Public verification</h3>
          <p>Every batch has a QR code. Scan it and read the complete,
          tamper-proof custody trail — no login, no wallet needed.</p>
        </div>
      </div>
    </>
  );
}
