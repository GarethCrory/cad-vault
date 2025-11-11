import fsp from "fs/promises";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = process.env.ASSEMBLY_STORE_PATH || path.join(DATA_DIR, "assemblies.json");

function scopeKey(projectNumber, projectName) {
  return `${projectNumber}::${projectName}`;
}

function partNumberPad(partNumber) {
  const digits = String(partNumber ?? "")
    .replace(/[^\d]/g, "")
    .slice(-3);
  if (!digits) {
    throw new Error("Invalid partNumber");
  }
  return digits.padStart(3, "0");
}

function parentKey({ typePrefix, partNumber }) {
  return `${typePrefix}-${partNumberPad(partNumber)}`;
}

function coerceFromCode(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const match = /^([A-Z])[-_]?(\d{1,3})$/.exec(code);
  if (!match) return null;
  return { typePrefix: match[1], partNumber: match[2] };
}

function normalizePart(raw = {}) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid part reference");
  }

  let { typePrefix, partNumber } = raw;
  if ((!typePrefix || !partNumber) && (raw.code || raw.partCode || raw.id || raw.key)) {
    const fallback = coerceFromCode(raw.code || raw.partCode || raw.id || raw.key);
    if (fallback) {
      typePrefix = typePrefix || fallback.typePrefix;
      partNumber = partNumber || fallback.partNumber;
    }
  }
  if (!typePrefix && raw.parentKey) {
    const fallback = coerceFromCode(raw.parentKey);
    if (fallback) {
      typePrefix = fallback.typePrefix;
      partNumber = partNumber || fallback.partNumber;
    }
  }

  const normalizedType = String(typePrefix || "").trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalizedType)) {
    throw new Error("Invalid typePrefix");
  }

  const normalizedPart = partNumberPad(partNumber);
  return { typePrefix: normalizedType, partNumber: normalizedPart };
}

function normalizeQty(rawQty) {
  const qty = Number(rawQty);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("Quantity must be a positive integer");
  return qty;
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function loadStore() {
  await ensureDataDir();
  try {
    const data = await fsp.readFile(STORE_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function saveStore(store) {
  await ensureDataDir();
  await fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getScope(store, scope) {
  if (!store[scope]) store[scope] = {};
  return store[scope];
}

function ensureNoCycle(scopeMap, startKey, targetKey, visited = new Set()) {
  if (startKey === targetKey) return true;
  if (visited.has(startKey)) return false;
  visited.add(startKey);
  const node = scopeMap[startKey];
  if (!node) return false;
  for (const child of node.children || []) {
    const childKey = parentKey(child);
    if (ensureNoCycle(scopeMap, childKey, targetKey, visited)) return true;
  }
  visited.delete(startKey);
  return false;
}

export async function listAssembly({ projectNumber, projectName, typePrefix, partNumber }) {
  const part = normalizePart({ typePrefix, partNumber });
  const store = await loadStore();
  const scope = scopeKey(projectNumber, projectName);
  const scopeMap = store[scope] || {};
  const key = parentKey(part);
  const parentRecord = scopeMap[key] || { parent: part, children: [] };
  const usedIn = [];
  Object.values(scopeMap).forEach((entry) => {
    (entry.children || []).forEach((child) => {
      if (parentKey(child) === key) {
        usedIn.push({
          parent: entry.parent,
          qty: child.qty,
        });
      }
    });
  });
  return {
    parent: parentRecord.parent,
    children: parentRecord.children || [],
    usedIn,
  };
}

export async function linkAssembly({ projectNumber, projectName, parent, child, qty }) {
  const parentPart = normalizePart(parent);
  const childPart = normalizePart(child);
  const quantity = normalizeQty(qty);

  const store = await loadStore();
  const scope = scopeKey(projectNumber, projectName);
  const scopeMap = getScope(store, scope);
  const parentKeyValue = parentKey(parentPart);
  const childKeyValue = parentKey(childPart);

  if (!scopeMap[parentKeyValue]) scopeMap[parentKeyValue] = { parent: parentPart, children: [] };

  if (ensureNoCycle(scopeMap, childKeyValue, parentKeyValue)) {
    const error = new Error("Circular link");
    error.status = 400;
    throw error;
  }

  const children = scopeMap[parentKeyValue].children;
  const existing = children.find((item) => parentKey(item) === childKeyValue);
  if (existing) {
    existing.qty = quantity;
  } else {
    children.push({ ...childPart, qty: quantity });
  }
  scopeMap[parentKeyValue].children = children;

  await saveStore(store);
  return listAssembly({ projectNumber, projectName, typePrefix: parentPart.typePrefix, partNumber: parentPart.partNumber });
}

export async function unlinkAssembly({ projectNumber, projectName, parent, child }) {
  const parentPart = normalizePart(parent);
  const childPart = normalizePart(child);
  const store = await loadStore();
  const scope = scopeKey(projectNumber, projectName);
  const scopeMap = getScope(store, scope);
  const parentKeyValue = parentKey(parentPart);
  const childKeyValue = parentKey(childPart);

  if (!scopeMap[parentKeyValue]) return listAssembly({ projectNumber, projectName, typePrefix: parentPart.typePrefix, partNumber: parentPart.partNumber });

  scopeMap[parentKeyValue].children = scopeMap[parentKeyValue].children.filter(
    (item) => parentKey(item) !== childKeyValue
  );

  await saveStore(store);
  return listAssembly({ projectNumber, projectName, typePrefix: parentPart.typePrefix, partNumber: parentPart.partNumber });
}

export async function updateAssemblyQty({ projectNumber, projectName, parent, child, qty }) {
  const parentPart = normalizePart(parent);
  const childPart = normalizePart(child);
  const quantity = normalizeQty(qty);

  const store = await loadStore();
  const scope = scopeKey(projectNumber, projectName);
  const scopeMap = getScope(store, scope);
  const parentKeyValue = parentKey(parentPart);
  const childKeyValue = parentKey(childPart);

  if (!scopeMap[parentKeyValue]) throw new Error("Parent assembly not found");
  const match = scopeMap[parentKeyValue].children.find((item) => parentKey(item) === childKeyValue);
  if (!match) throw new Error("Child link not found");
  match.qty = quantity;

  await saveStore(store);
  return listAssembly({ projectNumber, projectName, typePrefix: parentPart.typePrefix, partNumber: parentPart.partNumber });
}

export async function expandAssemblyTree(projectNumber, projectName, parent) {
  const parentPart = normalizePart(parent);
  const store = await loadStore();
  const scope = scopeKey(projectNumber, projectName);
  const scopeMap = store[scope] || {};
  const startKey = parentKey(parentPart);
  const totals = new Map();

  function dfs(currentKey, multiplier) {
    const node = scopeMap[currentKey];
    if (!node) return;
    for (const child of node.children || []) {
      const key = parentKey(child);
      const qty = child.qty * multiplier;
      totals.set(key, (totals.get(key) || 0) + qty);
      dfs(key, qty);
    }
  }

  dfs(startKey, 1);
  const result = [];
  for (const [key, qty] of totals.entries()) {
    const [typePrefix, partNumber] = key.split("-");
    result.push({ typePrefix, partNumber, qty });
  }
  return result;
}

export async function resetAssemblyStore() {
  if (fs.existsSync(STORE_PATH)) {
    await fsp.unlink(STORE_PATH);
  }
}
