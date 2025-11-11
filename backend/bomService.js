import fsp from "fs/promises";
import path from "path";
import { ensureProjectScaffold } from "./projectService.js";
import { scanProjectCAD } from "./scanService.js";

const DEFAULT_BOM = { updatedAt: null, items: [] };

function pad3(n) {
  return String(n).padStart(3, "0");
}

async function bomFile(projectNumber, projectName) {
  const { projectRoot } = await ensureProjectScaffold(projectNumber, projectName);
  return path.join(projectRoot, "bom.json");
}

async function loadPartsMap(projectNumber, projectName) {
  const scan = await scanProjectCAD(projectNumber, projectName);
  const map = new Map();
  for (const part of scan.parts || []) {
    const code = `${part.typePrefix}${pad3(part.partNumber)}`;
    map.set(code, {
      code,
      typePrefix: part.typePrefix,
      partNumber: pad3(part.partNumber),
      description: part.description || "",
    });
  }
  return map;
}

export async function loadBOM(projectNumber, projectName) {
  const file = await bomFile(projectNumber, projectName);
  try {
    const raw = await fsp.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.items) parsed.items = [];
    return parsed;
  } catch {
    return { ...DEFAULT_BOM };
  }
}

export async function saveBOM(projectNumber, projectName, data) {
  const file = await bomFile(projectNumber, projectName);
  await fsp.writeFile(file, JSON.stringify({
    updatedAt: new Date().toISOString(),
    items: data.items || [],
  }, null, 2), "utf8");
}

function normaliseCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!/^[ASPHO]\d{3}$/.test(code)) throw new Error("invalid_code");
  return code;
}

function normaliseItems(items = []) {
  return items.map((row) => {
    const child = normaliseCode(row.child);
    const qty = Math.max(1, parseInt(row.qty, 10) || 1);
    const note = String(row.note || "").trim();
    return { child, qty, note };
  });
}

function detectCycle(edges) {
  const graph = new Map();
  edges.forEach(({ parent, child }) => {
    if (!graph.has(parent)) graph.set(parent, []);
    graph.get(parent).push(child);
  });
  const visiting = new Set();
  const visited = new Set();

  function dfs(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}

export async function upsertItems(projectNumber, projectName, parentCode, incomingItems) {
  const parent = normaliseCode(parentCode);
  const items = normaliseItems(incomingItems);

  const parts = await loadPartsMap(projectNumber, projectName);
  const parentPart = parts.get(parent);
  if (!parentPart) throw new Error("parent_missing");
  if (!["A", "S"].includes(parentPart.typePrefix)) throw new Error("parent_type");

  for (const row of items) {
    const child = parts.get(row.child);
    if (!child) throw new Error(`child_missing_${row.child}`);
    if (child.typePrefix === "A") throw new Error("child_type");
  }

  const bom = await loadBOM(projectNumber, projectName);
  const filtered = bom.items.filter((item) => item.parent !== parent);
  const nextItems = [
    ...filtered,
    ...items.map((row) => ({ parent, child: row.child, qty: row.qty, note: row.note })),
  ];

  if (detectCycle(nextItems)) throw new Error("cycle");

  await saveBOM(projectNumber, projectName, { items: nextItems });
  return { ok: true };
}

export async function getChildren(projectNumber, projectName, parentCode) {
  const parent = normaliseCode(parentCode);
  const parts = await loadPartsMap(projectNumber, projectName);
  const bom = await loadBOM(projectNumber, projectName);
  return bom.items
    .filter((item) => item.parent === parent)
    .map((item) => {
      const meta = parts.get(item.child) || {};
      return {
        parent,
        code: item.child,
        qty: item.qty,
        note: item.note || "",
        typePrefix: meta.typePrefix || item.child[0],
        partNumber: meta.partNumber || item.child.slice(1),
        description: meta.description || "",
      };
    });
}

export async function loadBomSummary(projectNumber, projectName) {
  const bom = await loadBOM(projectNumber, projectName);
  return bom.items;
}

export async function buildTree(projectNumber, projectName, rootCode) {
  const root = normaliseCode(rootCode);
  const parts = await loadPartsMap(projectNumber, projectName);
  const bom = await loadBOM(projectNumber, projectName);
  const graph = new Map();
  bom.items.forEach((item) => {
    if (!graph.has(item.parent)) graph.set(item.parent, []);
    graph.get(item.parent).push(item);
  });

  const stack = new Set();

  function walk(code, multiplier = 1) {
    if (stack.has(code)) throw new Error("cycle");
    stack.add(code);
    const meta = parts.get(code) || {};
    const children = (graph.get(code) || []).map((edge) => {
      const childNode = walk(edge.child, multiplier * edge.qty);
      return {
        ...childNode,
        edgeQty: edge.qty,
      };
    });
    stack.delete(code);
    return {
      code,
      qty: multiplier,
      description: meta.description || "",
      typePrefix: meta.typePrefix || code[0],
      partNumber: meta.partNumber || code.slice(1),
      children,
    };
  }

  if (!parts.has(root)) throw new Error("root_missing");
  const tree = walk(root, 1);
  return tree;
}

export async function removePartReferences(projectNumber, projectName, code) {
  const target = normaliseCode(code);
  const bom = await loadBOM(projectNumber, projectName);
  const items = bom.items || [];
  const filtered = items.filter((item) => item.parent !== target && item.child !== target);
  const removed = items.length - filtered.length;
  if (removed > 0) {
    await saveBOM(projectNumber, projectName, { items: filtered });
  }
  return { removed };
}
