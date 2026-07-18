import { useCallback, useEffect, useState } from "react";
import { readContracts } from "./web3.jsx";

/** Loads all batches + participant names from the chain (read-only provider,
 *  so it works without a wallet). */
export function useBatches(refreshKey = 0) {
  const [batches, setBatches] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const c = readContracts();
      const total = Number(await c.nft.totalBatches());
      const list = [];
      for (let id = 1; id <= total; id++) {
        try {
          const [b, owner] = await Promise.all([c.nft.getBatch(id), c.nft.ownerOf(id)]);
          list.push({
            id,
            owner: owner.toLowerCase(),
            farmer: b.farmer.toLowerCase(),
            origin: b.origin,
            variety: b.variety,
            weightKg: Number(b.weightKg),
            harvestYear: Number(b.harvestYear),
            qualityScore: Number(b.qualityScore),
            stage: Number(b.stage),
            docURI: b.docURI,
            createdAt: Number(b.createdAt),
          });
        } catch { /* burned or missing */ }
      }
      // participant names
      const n = {};
      const totalP = Number(await c.registry.totalParticipants());
      for (let i = 0; i < totalP; i++) {
        const addr = (await c.registry.participantAt(i)).toLowerCase();
        const p = await c.registry.getParticipant(addr);
        n[addr] = p.name;
      }
      setBatches(list);
      setNames(n);
    } catch (e) {
      setErr("Could not reach the local blockchain. Is `npx hardhat node` running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  return { batches, names, loading, err, reload: load };
}

export async function loadShipments(id) {
  const c = readContracts();
  const raw = await c.nft.getShipments(id);
  return raw.map((s) => ({
    from: s.from, to: s.to,
    stageAfter: Number(s.stageAfter),
    note: s.note,
    timestamp: Number(s.timestamp),
  }));
}

export async function loadDeal(id) {
  const c = readContracts();
  const d = await c.escrow.getDeal(id);
  return {
    tokenId: Number(d.tokenId),
    seller: d.seller, buyer: d.buyer,
    amount: d.amount,
    state: Number(d.state), // 0 none 1 funded 2 released 3 refunded
    fundedAt: Number(d.fundedAt),
    deliveryNote: d.deliveryNote,
  };
}

export async function loadPrice() {
  const c = readContracts();
  const p = await c.oracle.latestPrice();
  return Number(p) / 1e8; // USD per kg
}
