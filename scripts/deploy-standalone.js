// Deploys all contracts to the local node using the solc build artifacts.
// Run: node scripts/deploy-standalone.js   (with `npx hardhat node` running)
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = "http://127.0.0.1:8545";
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat account #0
const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", `${n}.json`), "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  provider.pollingInterval = 100;
  const admin = new ethers.NonceManager(new ethers.Wallet(ADMIN_KEY, provider));
  const adminAddr = await admin.getAddress();
  console.log("Deploying with admin:", adminAddr);

  async function deploy(name, args) {
    const a = load(name);
    const f = new ethers.ContractFactory(a.abi, a.bytecode, admin);
    const c = await f.deploy(...args);
    await c.deploymentTransaction().wait(1);
    const addr = await c.getAddress();
    console.log(`  ${name}: ${addr}`);
    return c;
  }

  const registry = await deploy("ParticipantRegistry", [adminAddr]);
  const nft = await deploy("CoffeeBatchNFT", [await registry.getAddress(), adminAddr]);
  const oracle = await deploy("MockPriceOracle", [485000000n]); // $4.85/kg
  const escrow = await deploy("CoffeeEscrow", [await nft.getAddress(), await registry.getAddress()]);

  await (await nft.setOperator(await escrow.getAddress(), true)).wait();
  console.log("  Escrow authorized as NFT custody operator");

  const deployment = {
    chainId: Number((await provider.getNetwork()).chainId),
    admin: adminAddr,
    contracts: {
      ParticipantRegistry: await registry.getAddress(),
      CoffeeBatchNFT: await nft.getAddress(),
      MockPriceOracle: await oracle.getAddress(),
      CoffeeEscrow: await escrow.getAddress(),
    },
  };
  const outDir = path.join(__dirname, "..", "frontend", "src", "lib");
  fs.mkdirSync(outDir, { recursive: true }); // may not exist inside the chain container
  const out = path.join(outDir, "deployment.json");
  fs.writeFileSync(out, JSON.stringify(deployment, null, 2));
  console.log("Wrote", out);
  console.log("\nDone. Next: node scripts/seed.js (optional demo data), then run the frontend.");
}

main().catch((e) => { console.error(e); process.exit(1); });
