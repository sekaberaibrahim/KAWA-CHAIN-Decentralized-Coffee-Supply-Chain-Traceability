// Standalone compile using the npm `solc` package (no network needed).
// Resolves OpenZeppelin imports from node_modules and writes artifacts
// compatible with what our deploy/test tooling needs.
const solc = require("solc");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTRACTS = path.join(ROOT, "contracts");
const OUT = path.join(ROOT, "build");

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

// Import resolver: handles @openzeppelin/... and relative ./ imports.
function findImport(importPath) {
  let full;
  if (importPath.startsWith("@")) {
    full = path.join(ROOT, "node_modules", importPath);
  } else {
    // relative to contracts dir
    full = path.join(CONTRACTS, importPath);
  }
  const contents = readFileSafe(full);
  if (contents == null) return { error: "File not found: " + importPath };
  return { contents };
}

function main() {
  const sources = {};
  for (const f of fs.readdirSync(CONTRACTS)) {
    if (f.endsWith(".sol")) {
      sources[f] = { content: fs.readFileSync(path.join(CONTRACTS, f), "utf8") };
    }
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImport })
  );

  let hasError = false;
  if (output.errors) {
    for (const e of output.errors) {
      if (e.severity === "error") { hasError = true; console.error(e.formattedMessage); }
      else console.warn(e.formattedMessage);
    }
  }
  if (hasError) { console.error("\nCompilation FAILED"); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });
  const abiDir = path.join(ROOT, "frontend", "src", "abis");
  fs.mkdirSync(abiDir, { recursive: true });

  const wanted = ["ParticipantRegistry", "CoffeeBatchNFT", "MockPriceOracle", "CoffeeEscrow"];
  for (const file in output.contracts) {
    for (const name in output.contracts[file]) {
      const c = output.contracts[file][name];
      const artifact = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(artifact, null, 2));
      if (wanted.includes(name)) {
        fs.writeFileSync(path.join(abiDir, `${name}.json`), JSON.stringify(c.abi, null, 2));
      }
    }
  }
  console.log("Compilation OK. Artifacts in build/, ABIs in frontend/src/abis/");
}

main();
