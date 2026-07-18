// End-to-end flow test against a running local node (http://127.0.0.1:8545).
// Deploys all contracts from compiled artifacts and drives the full lifecycle:
// register -> mint batch -> processor -> exporter -> buyer escrow -> settle.
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const RPC = "http://127.0.0.1:8545";
const B = (n) => path.join(__dirname, "..", "build", `${n}.json`);
const load = (n) => JSON.parse(fs.readFileSync(B(n), "utf8"));

// Hardhat default accounts
const KEYS = {
  admin:     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  farmer:    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  processor: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  exporter:  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  buyer:     "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
};

async function deploy(artifact, signer, args = []) {
  const f = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const c = await f.deploy(...args);
  await c.deploymentTransaction().wait(1);
  return c;
}

let passed = 0;
function check(label, cond) {
  assert(cond, "FAILED: " + label);
  console.log("  \u2713", label);
  passed++;
}

// A reverted tx may leave a NonceManager's optimistic counter ahead of chain.
// Reset it so subsequent txs from that signer use the correct nonce.
function resetNonce(signer) {
  if (typeof signer.reset === "function") signer.reset();
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  provider.pollingInterval = 100;
  // Wrap each wallet in a NonceManager so sequential txs from the same account
  // get correctly incrementing nonces even under fast auto-mining.
  const S = Object.fromEntries(
    Object.entries(KEYS).map(([k, v]) => [
      k,
      new ethers.NonceManager(new ethers.Wallet(v, provider)),
    ])
  );
  // Convenience: expose provider + address on the managed signers.
  for (const k of Object.keys(S)) {
    S[k].address = new ethers.Wallet(KEYS[k]).address;
    S[k].provider = provider;
  }

  console.log("block:", await provider.getBlockNumber(),
              "| admin nonce:", await provider.getTransactionCount(S.admin.address));
  console.log("\nDeploying contracts...");
  const registry = await deploy(load("ParticipantRegistry"), S.admin, [S.admin.address]);
  const nft = await deploy(load("CoffeeBatchNFT"), S.admin, [await registry.getAddress(), S.admin.address]);
  const oracle = await deploy(load("MockPriceOracle"), S.admin, [485000000n]);
  const escrow = await deploy(load("CoffeeEscrow"), S.admin, [await nft.getAddress(), await registry.getAddress()]);
  await (await nft.setOperator(await escrow.getAddress(), true)).wait();
  console.log("Deployed + wired.\n");

  console.log("Registration & RBAC:");
  await (await registry.connect(S.farmer).registerFarmer("Kopakama Coop", "Nyamasheke", "ipfs://farmer")).wait();
  await (await registry.connect(S.processor).registerProcessor("Muhondo Washing", "Gakenke", "ipfs://proc")).wait();
  await (await registry.connect(S.exporter).registerExporter("RwaCof Exports", "Kigali", "ipfs://exp")).wait();
  await (await registry.connect(S.buyer).registerBuyer("Nordic Roasters", "Oslo", "ipfs://buyer")).wait();
  check("farmer has FARMER_ROLE", await registry.hasActiveRole(S.farmer.address, await registry.FARMER_ROLE()));
  check("buyer has BUYER_ROLE", await registry.hasActiveRole(S.buyer.address, await registry.BUYER_ROLE()));
  check("total participants = 4", (await registry.totalParticipants()) === 4n);

  // non-farmer cannot register a batch
  let reverted = false;
  try { await (await nft.connect(S.buyer).registerBatch("x","y",1,2026,80,"ipfs://d")).wait(); }
  catch { reverted = true; }
  resetNonce(S.buyer);
  check("non-farmer batch registration reverts", reverted);

  console.log("\nBatch lifecycle:");
  await (await nft.connect(S.farmer).registerBatch(
    "Kopakama, Lot 7", "Red Bourbon", 1200, 2026, 86, "ipfs://batch-metadata"
  )).wait();
  check("batch minted to farmer", (await nft.ownerOf(1)) === S.farmer.address);
  let b = await nft.getBatch(1);
  check("stage = Harvested (0)", b.stage === 0n);

  // farmer -> processor
  await (await nft.connect(S.farmer).transferCustody(1, S.processor.address, "To washing station")).wait();
  check("custody now processor", (await nft.ownerOf(1)) === S.processor.address);
  check("stage = Processed (1)", (await nft.getBatch(1)).stage === 1n);

  // processor -> exporter
  await (await nft.connect(S.processor).transferCustody(1, S.exporter.address, "Milled, graded")).wait();
  check("custody now exporter", (await nft.ownerOf(1)) === S.exporter.address);
  check("stage = Exported (2)", (await nft.getBatch(1)).stage === 2n);

  // invalid skip: exporter -> another exporter should fail (buyer required next)
  reverted = false;
  try { await (await nft.connect(S.exporter).transferCustody(1, S.farmer.address, "bad")).wait(); }
  catch { reverted = true; }
  resetNonce(S.exporter);
  check("invalid custody hop reverts", reverted);

  console.log("\nEscrow settlement:");
  const price = await oracle.quote(1200); // 8-decimals USD
  check("oracle quote > 0", price > 0n);
  const amount = ethers.parseEther("2.5");

  const sellerBefore = await provider.getBalance(S.exporter.address);
  await (await escrow.connect(S.buyer).fundDeal(1, { value: amount })).wait();
  let deal = await escrow.getDeal(1);
  check("deal funded state = 1", deal.state === 1n);
  check("escrow holds funds", (await provider.getBalance(await escrow.getAddress())) === amount);

  await (await escrow.connect(S.buyer).confirmDelivery(1, "Received at Oslo port")).wait();
  check("custody now buyer", (await nft.ownerOf(1)) === S.buyer.address);
  check("stage = Delivered (3)", (await nft.getBatch(1)).stage === 3n);
  check("deal released state = 2", (await escrow.getDeal(1)).state === 2n);
  const sellerAfter = await provider.getBalance(S.exporter.address);
  check("seller paid", sellerAfter - sellerBefore === amount);

  console.log("\nTraceability trail:");
  const ship = await nft.getShipments(1);
  check("shipment log has 4 entries", ship.length === 4);
  check("first entry is harvest", ship[0].from === ethers.ZeroAddress);

  console.log(`\nAll ${passed} checks passed.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
