import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import registryAbi from "../abis/ParticipantRegistry.json";
import nftAbi from "../abis/CoffeeBatchNFT.json";
import oracleAbi from "../abis/MockPriceOracle.json";
import escrowAbi from "../abis/CoffeeEscrow.json";
import deployment from "./deployment.json";

const Web3Ctx = createContext(null);

export const ROLES = ["None", "Farmer", "Processor", "Exporter", "Buyer"];
export const STAGES = ["Harvested", "Processed", "Exported", "Delivered"];

// Read-only provider so public pages (QR verify, analytics) work
// without MetaMask connected.
export const readProvider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

export function readContracts() {
  const a = deployment.contracts;
  return {
    registry: new Contract(a.ParticipantRegistry, registryAbi, readProvider),
    nft: new Contract(a.CoffeeBatchNFT, nftAbi, readProvider),
    oracle: new Contract(a.MockPriceOracle, oracleAbi, readProvider),
    escrow: new Contract(a.CoffeeEscrow, escrowAbi, readProvider),
  };
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [role, setRole] = useState(0); // enum index
  const [participant, setParticipant] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const buildContracts = useCallback((signerOrProvider) => {
    const a = deployment.contracts;
    return {
      registry: new Contract(a.ParticipantRegistry, registryAbi, signerOrProvider),
      nft: new Contract(a.CoffeeBatchNFT, nftAbi, signerOrProvider),
      oracle: new Contract(a.MockPriceOracle, oracleAbi, signerOrProvider),
      escrow: new Contract(a.CoffeeEscrow, escrowAbi, signerOrProvider),
    };
  }, []);

  const refreshRole = useCallback(async (addr, c) => {
    try {
      const p = await c.registry.getParticipant(addr);
      setRole(Number(p.role));
      setParticipant({
        name: p.name,
        location: p.location,
        metadataURI: p.metadataURI,
        active: p.active,
        registeredAt: Number(p.registeredAt),
      });
    } catch {
      setRole(0);
      setParticipant(null);
    }
  }, []);

  const connect = useCallback(async () => {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask is not installed. Install it from metamask.io (free), then reload.");
      return;
    }
    setConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      // Prompt network switch to the local Hardhat chain if needed
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== deployment.chainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + deployment.chainId.toString(16) }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x" + deployment.chainId.toString(16),
                chainName: "Sepolia Testnet",
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          }
        }
      }
      const accounts = await provider.send("eth_requestAccounts", []);
      const s = await provider.getSigner();
      const c = buildContracts(s);
      setAccount(accounts[0]);
      setSigner(s);
      setContracts(c);
      await refreshRole(accounts[0], c);
    } catch (e) {
      setError(e.shortMessage || e.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [buildContracts, refreshRole]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setContracts(null);
    setRole(0);
    setParticipant(null);
  }, []);

  // React to account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accs) => {
      if (accs.length === 0) disconnect();
      else connect();
    };
    const onChain = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [connect, disconnect]);

  const value = {
    account, signer, contracts, role, participant,
    connecting, error, connect, disconnect,
    refresh: () => account && contracts && refreshRole(account, contracts),
  };
  return <Web3Ctx.Provider value={value}>{children}</Web3Ctx.Provider>;
}

export function useWeb3() {
  return useContext(Web3Ctx);
}

export function short(addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—";
}
