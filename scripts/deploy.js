const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Deploying with admin:", admin.address);

  // 1. Registry (RBAC)
  const Registry = await hre.ethers.getContractFactory("ParticipantRegistry");
  const registry = await Registry.deploy(admin.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("ParticipantRegistry:", registryAddr);

  // 2. Coffee Batch NFT
  const NFT = await hre.ethers.getContractFactory("CoffeeBatchNFT");
  const nft = await NFT.deploy(registryAddr, admin.address);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("CoffeeBatchNFT:", nftAddr);

  // 3. Mock Oracle - initial price 4.85 USD/kg (8 decimals)
  const Oracle = await hre.ethers.getContractFactory("MockPriceOracle");
  const oracle = await Oracle.deploy(485000000n);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("MockPriceOracle:", oracleAddr);

  // 4. Escrow
  const Escrow = await hre.ethers.getContractFactory("CoffeeEscrow");
  const escrow = await Escrow.deploy(nftAddr, registryAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("CoffeeEscrow:", escrowAddr);

  // Wire: allow escrow to move custody on settlement
  await (await nft.setOperator(escrowAddr, true)).wait();
  console.log("Escrow authorized as NFT operator");

  // Write deployment addresses for the frontend
  const deployment = {
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    admin: admin.address,
    contracts: {
      ParticipantRegistry: registryAddr,
      CoffeeBatchNFT: nftAddr,
      MockPriceOracle: oracleAddr,
      CoffeeEscrow: escrowAddr,
    },
  };

  const outDir = path.join(__dirname, "..", "frontend", "src", "lib");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("Wrote deployment.json to frontend/src/lib/");

  // Copy ABIs for the frontend
  copyAbis(["ParticipantRegistry", "CoffeeBatchNFT", "MockPriceOracle", "CoffeeEscrow"]);
}

function copyAbis(names) {
  const abiDir = path.join(__dirname, "..", "frontend", "src", "abis");
  fs.mkdirSync(abiDir, { recursive: true });
  for (const name of names) {
    const artifact = require(path.join(
      __dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`
    ));
    fs.writeFileSync(
      path.join(abiDir, `${name}.json`),
      JSON.stringify(artifact.abi, null, 2)
    );
  }
  console.log("Copied ABIs to frontend/src/abis/");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
