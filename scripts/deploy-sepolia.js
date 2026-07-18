// Deploys all contracts to Sepolia testnet (free).
// Usage:
//   DEPLOYER_KEY=0xYourPrivateKey node scripts/deploy-sepolia.js
//
// Prerequisites:
//   1. Get free Sepolia ETH from https://cloud.google.com/application/web3/faucet/ethereum/sepolia
//   2. Export your MetaMask private key (Account details → Show private key)
//   3. Run this script (from Docker or local Node.js)

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Free public Sepolia RPCs (no API key needed)
const SEPOLIA_RPCS = [
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.gateway.tenderly.co",
  "https://1rpc.io/sepolia",
];

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
if (!DEPLOYER_KEY) {
  console.error("\n✗ Missing DEPLOYER_KEY environment variable.\n");
  console.error("Usage:");
  console.error("  DEPLOYER_KEY=0xYourPrivateKey node scripts/deploy-sepolia.js\n");
  console.error("How to get your private key from MetaMask:");
  console.error("  1. Open MetaMask → click the three dots (⋮) on your account");
  console.error("  2. Click 'Account details'");
  console.error("  3. Click 'Show private key'");
  console.error("  4. Enter your MetaMask password");
  console.error("  5. Copy the key (starts with 0x...)\n");
  console.error("How to get free Sepolia ETH:");
  console.error("  → https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
  console.error("  → https://www.alchemy.com/faucets/ethereum-sepolia");
  console.error("  → https://sepolia-faucet.pk910.de (PoW mining faucet, no account needed)\n");
  process.exit(1);
}

const load = (n) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "build", `${n}.json`), "utf8")
  );

async function tryConnect() {
  for (const url of SEPOLIA_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      console.log(`Connected to Sepolia via ${url}`);
      return p;
    } catch {
      // try next
    }
  }
  throw new Error(
    "Could not connect to any Sepolia RPC. Check your internet connection."
  );
}

async function main() {
  const provider = await tryConnect();
  const admin = new ethers.Wallet(DEPLOYER_KEY, provider);
  const adminAddr = await admin.getAddress();
  const balance = await provider.getBalance(adminAddr);
  const balEth = ethers.formatEther(balance);

  console.log(`\nDeployer: ${adminAddr}`);
  console.log(`Balance:  ${balEth} SepoliaETH`);

  if (balance < ethers.parseEther("0.01")) {
    console.error(
      "\n✗ Not enough SepoliaETH. You need at least 0.01 to deploy."
    );
    console.error("Get free SepoliaETH from:");
    console.error(
      "  → https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
    );
    console.error("  → https://www.alchemy.com/faucets/ethereum-sepolia\n");
    process.exit(1);
  }

  console.log("\nDeploying contracts to Sepolia (this takes 1–3 minutes)...\n");

  async function deploy(name, args) {
    const a = load(name);
    const f = new ethers.ContractFactory(a.abi, a.bytecode, admin);
    console.log(`  Deploying ${name}...`);
    const c = await f.deploy(...args);
    const receipt = await c.deploymentTransaction().wait(2); // wait for 2 confirmations
    const addr = await c.getAddress();
    console.log(`  ✓ ${name}: ${addr}  (tx: ${receipt.hash})`);
    return c;
  }

  const registry = await deploy("ParticipantRegistry", [adminAddr]);
  const nft = await deploy("CoffeeBatchNFT", [
    await registry.getAddress(),
    adminAddr,
  ]);
  const oracle = await deploy("MockPriceOracle", [485000000n]); // $4.85/kg
  const escrow = await deploy("CoffeeEscrow", [
    await nft.getAddress(),
    await registry.getAddress(),
  ]);

  console.log("\n  Authorizing escrow as NFT operator...");
  const opTx = await nft.setOperator(await escrow.getAddress(), true);
  await opTx.wait(2);
  console.log("  ✓ Escrow authorized");

  const deployment = {
    chainId: 11155111, // Sepolia
    network: "sepolia",
    admin: adminAddr,
    contracts: {
      ParticipantRegistry: await registry.getAddress(),
      CoffeeBatchNFT: await nft.getAddress(),
      MockPriceOracle: await oracle.getAddress(),
      CoffeeEscrow: await escrow.getAddress(),
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "frontend", "src", "lib");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "deployment.json");
  fs.writeFileSync(out, JSON.stringify(deployment, null, 2));
  console.log(`\nWrote ${out}`);

  console.log("\n══════════════════════════════════════════");
  console.log("  ✓ ALL CONTRACTS DEPLOYED TO SEPOLIA");
  console.log("══════════════════════════════════════════");
  console.log(`\n  ParticipantRegistry: ${deployment.contracts.ParticipantRegistry}`);
  console.log(`  CoffeeBatchNFT:      ${deployment.contracts.CoffeeBatchNFT}`);
  console.log(`  MockPriceOracle:     ${deployment.contracts.MockPriceOracle}`);
  console.log(`  CoffeeEscrow:        ${deployment.contracts.CoffeeEscrow}`);
  console.log(`\n  Verify on Etherscan:`);
  console.log(`  https://sepolia.etherscan.io/address/${deployment.contracts.ParticipantRegistry}`);
  console.log(`\nNext steps:`);
  console.log(`  1. cd frontend && npm run dev`);
  console.log(`  2. Open http://localhost:5173`);
  console.log(`  3. MetaMask should auto-switch to Sepolia`);
  console.log(`  4. Use the SAME account that deployed (${adminAddr.slice(0, 10)}...)`);
  console.log(`     or any account with Sepolia ETH`);
  console.log(`\n  Contracts are permanent on Sepolia — no need to re-deploy!\n`);
}

main().catch((e) => {
  console.error("\n✗ Deployment failed:", e.message || e);
  process.exit(1);
});
