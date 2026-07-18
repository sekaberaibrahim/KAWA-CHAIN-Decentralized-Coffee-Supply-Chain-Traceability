# KAWA·CHAIN — Decentralized Coffee Supply Chain Traceability

A complete dApp that tracks Rwandan coffee batches from farmer to buyer on a
blockchain. Every batch is an ERC-721 NFT certificate; custody moves
Farmer → Processor → Exporter → Buyer with each hand-off validated by
on-chain role-based access control; payment is held in escrow and released
atomically on delivery; documents are stored via IPFS; and anyone can verify
a batch with a QR code — no wallet needed.

**Everything in this project runs 100% free**: a local Hardhat blockchain
(free), MetaMask (free), Hardhat's built-in funded test accounts (free fake
ETH), and a local mock IPFS with the same interface as the real thing.

---

## Architecture

```
contracts/
  ParticipantRegistry.sol   Enterprise RBAC (OpenZeppelin AccessControl)
                            + farmer/processor/exporter/buyer registration
  CoffeeBatchNFT.sol        ERC-721 batch certificates, custody transfer with
                            role-validated stage progression, shipment log
  MockPriceOracle.sol       Chainlink-compatible COFFEE/USD price feed (mock)
  CoffeeEscrow.sol          Buyer funds escrow -> confirm delivery ->
                            NFT transfers + seller paid atomically

frontend/                   React (Vite) app
  Landing page · MetaMask login · role registration
  Farmer / Processor / Exporter / Buyer dashboards
  Shipment tracker · QR generation + camera scanning · public verification
  Analytics dashboard with charts + on-chain event log
```

Custody flow enforced by the contracts themselves:

```
FARMER ──mint──> Harvested ──transfer──> Processed ──transfer──> Exported ──escrow settle──> Delivered
         (NFT)      (only to a registered      (only to a           (only to a registered buyer,
                     active processor)          registered           via escrow confirmDelivery)
                                                exporter)
```

---

## Prerequisites (all free)

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop
   (no Node.js or npm needed on your machine — they live inside the containers)
2. **MetaMask browser extension** — https://metamask.io
3. That's it. No API keys, no accounts, no testnet faucets.

---

## Run everything with ONE command (Docker)

```bash
docker compose up --build
```

That single command:
1. builds the blockchain container (installs Node deps + compiles the Solidity contracts inside it),
2. starts a fresh Hardhat chain on port **8545**,
3. auto-deploys all four contracts,
4. auto-seeds demo participants + batches,
5. builds and starts the React app on port **5173**.

When the logs show *"Blockchain ready on port 8545"*, open:

**http://localhost:5173**

To stop: `Ctrl+C` (or `docker compose down`).
To restart fresh: `docker compose up` — the chain resets and re-seeds itself
every start (remember to clear MetaMask activity data, see tip below).
The first build takes a few minutes; later starts are fast.

<details>
<summary>Alternative: run without Docker (if you have Node.js 18+)</summary>

```bash
npm install && node scripts/compile-solc.js          # once
cd frontend && npm install && cd ..                  # once

npx hardhat node                                     # terminal 1 — leave running
node scripts/deploy-standalone.js && node scripts/seed.js   # terminal 2
cd frontend && npm run dev                           # terminal 3
```
Open http://localhost:5173
</details>

---

## MetaMask setup (one time, ~2 minutes)

1. In MetaMask → network selector → **Add network manually**:
   - Network name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
   (The app will also offer to add/switch this network for you.)

2. Import the demo accounts (Account menu → **Import account** → paste key).
   These are Hardhat's public test keys — they only exist on your machine.

   | Role      | Private key |
   |-----------|-------------|
   | Farmer    | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
   | Processor | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
   | Exporter  | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
   | Buyer     | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

   ⚠️ Never use these keys on a real network — they are publicly known.

3. Switch between the imported accounts in MetaMask to act as each role.

> **Tip:** if you restart `npx hardhat node`, the chain resets. Re-run the
> deploy + seed scripts, and in MetaMask use *Settings → Advanced →
> Clear activity tab data* on each imported account to reset stale nonces.

---

## The full demo walkthrough

1. **Farmer account** → Dashboard → *Register a new harvest* → mint the NFT.
2. Still as Farmer → *Hand to processor* → paste the processor address
   (`0x3C44...93BC`) with a shipment note.
3. **Processor account** → Dashboard → *Hand to exporter* (`0x90F7...b906`).
4. **Buyer account** → Dashboard → the batch appears in *Market* →
   enter an ETH amount → **Fund escrow** (funds lock in the contract).
5. When the coffee "arrives", Buyer clicks **Confirm delivery** — one
   transaction transfers the NFT certificate to the buyer AND pays the
   exporter. Check the exporter's ETH balance go up.
6. Open the batch page → print/scan the **QR code** → the public
   verification page shows the complete provenance trail, no wallet needed.
7. **Analytics** shows live charts and the raw blockchain event log.

Wrong-order transfers (e.g. farmer → buyer directly) are rejected by the
smart contract — try it and watch the transaction revert.

---

## Testing

The e2e suite deploys everything fresh and drives the entire lifecycle,
including negative cases (RBAC rejections, invalid custody hops).
With Docker only, run it inside the chain image:

```bash
docker compose run --rm --entrypoint bash chain ./run-e2e.sh
```

Or with local Node.js: `./run-e2e.sh` — 20 checks, self-contained.

---

## About the free substitutions

| Real-world component | Free stand-in used here | Swap path |
|---|---|---|
| Ethereum mainnet / testnet | Hardhat local node | change `networks` in `hardhat.config.js` |
| Chainlink price feed | `MockPriceOracle` (same interface) | point at a real AggregatorV3 address |
| Pinata / web3.storage IPFS | `frontend/src/lib/ipfs.js` mock (same API, localStorage-backed, CID-style hashes) | replace two functions with a real client |
| Paid RPC provider | none needed locally | Infura/Alchemy free tier |

The contracts themselves are production-grade patterns (OpenZeppelin
AccessControl, ERC721URIStorage, ReentrancyGuard, checks-effects-interactions)
— nothing about the free setup weakens the on-chain logic.
