// Mock IPFS — free, zero-setup replacement for Pinata/web3.storage.
// Stores JSON documents in localStorage keyed by a deterministic CID-like hash.
// The interface (add/get returning ipfs:// URIs) matches what a real IPFS
// integration would expose, so swapping in a real client later is one file.

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Base58-ish alphabet for a CID-looking string (visual authenticity only).
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toCidLike(hex) {
  let out = "Qm";
  for (let i = 0; i < 44; i += 1) {
    const byte = parseInt(hex.slice((i * 2) % 62, ((i * 2) % 62) + 2), 16);
    out += B58[byte % B58.length];
  }
  return out;
}

const PREFIX = "mockipfs:";

export async function ipfsAdd(obj) {
  const json = JSON.stringify(obj);
  const cid = toCidLike(await sha256Hex(json));
  localStorage.setItem(PREFIX + cid, json);
  return `ipfs://${cid}`;
}

export function ipfsGet(uri) {
  if (!uri) return null;
  const cid = uri.replace("ipfs://", "");
  const raw = localStorage.getItem(PREFIX + cid);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function shortCid(uri) {
  if (!uri) return "—";
  const cid = uri.replace("ipfs://", "");
  return cid.slice(0, 6) + "…" + cid.slice(-4);
}
