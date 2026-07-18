// Seeds the local chain with demo participants and batches so the app has
// life on first open. Uses Hardhat's built-in (free) funded accounts:
//   #0 admin, #1 farmer, #2 processor, #3 exporter, #4 buyer
// Run AFTER deploy:  node scripts/seed.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = "http://127.0.0.1:8545";
const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", `${n}.json`), "utf8"));
const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "src", "lib", "deployment.json"), "utf8"));

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // admin
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // farmer
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // processor
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // exporter
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // buyer
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  provider.pollingInterval = 100;
  const [admin, farmer, processor, exporter, buyer] =
    KEYS.map((k) => new ethers.NonceManager(new ethers.Wallet(k, provider)));

  const registry = new ethers.Contract(dep.contracts.ParticipantRegistry, load("ParticipantRegistry").abi, provider);
  const nft = new ethers.Contract(dep.contracts.CoffeeBatchNFT, load("CoffeeBatchNFT").abi, provider);

  const farmerAddr = await farmer.getAddress();
  const processorAddr = await processor.getAddress();
  const exporterAddr = await exporter.getAddress();

  console.log("Seeding participants…");
  const already = await registry.getParticipant(farmerAddr);
  if (Number(already.role) === 0) {
    await (await registry.connect(farmer).registerFarmer("Kopakama Cooperative", "Rutsiro, Western Province", "ipfs://seed-farmer")).wait();
    await (await registry.connect(processor).registerProcessor("Muhondo Washing Station", "Gakenke, Northern Province", "ipfs://seed-processor")).wait();
    await (await registry.connect(exporter).registerExporter("RwaCof Exports Ltd", "Kigali", "ipfs://seed-exporter")).wait();
    await (await registry.connect(buyer).registerBuyer("Nordic Roasters AS", "Oslo, Norway", "ipfs://seed-buyer")).wait();
    console.log("  4 participants registered");
  } else {
    console.log("  participants already exist, skipping");
  }

  console.log("Seeding batches…");
  const total = Number(await nft.totalBatches());
  if (total === 0) {
    // Batch 1: full journey to Exported (ready for a buyer)
    await (await nft.connect(farmer).registerBatch(
      "Kopakama, Lot 7 — Rutsiro", "Red Bourbon", 1200, 2026, 86, "ipfs://seed-batch-1")).wait();
    await (await nft.connect(farmer).transferCustody(1, processorAddr, "Truck RW-341 to Muhondo station")).wait();
    await (await nft.connect(processor).transferCustody(1, exporterAddr, "Milled, graded AA — 18 bags")).wait();

    // Batch 2: at the processor
    await (await nft.connect(farmer).registerBatch(
      "Kopakama, Lot 12 — Rutsiro", "Bourbon Mayaguez", 800, 2026, 84, "ipfs://seed-batch-2")).wait();
    await (await nft.connect(farmer).transferCustody(2, processorAddr, "Morning delivery, cherry sorted")).wait();

    // Batch 3: freshly harvested
    await (await nft.connect(farmer).registerBatch(
      "Kopakama, Lot 15 — Rutsiro", "Red Bourbon", 950, 2026, 88, "ipfs://seed-batch-3")).wait();

    console.log("  3 batches created (stages: Exported, Processed, Harvested)");
  } else {
    console.log(`  ${total} batches already exist, skipping`);
  }

  console.log("\nSeed complete. Demo accounts (import into MetaMask with these private keys):");
  console.log("  Farmer    ", farmerAddr, "\n            ", KEYS[1]);
  console.log("  Processor ", processorAddr, "\n            ", KEYS[2]);
  console.log("  Exporter  ", exporterAddr, "\n            ", KEYS[3]);
  console.log("  Buyer     ", await buyer.getAddress(), "\n            ", KEYS[4]);
  console.log("\nThese are Hardhat's public test keys — free, local only, never use on a real network.");
}

main().catch((e) => { console.error(e); process.exit(1); });
