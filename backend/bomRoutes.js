import express from "express";
import { ensureProjectScaffold } from "./projectService.js";
import { buildTree, getChildren, loadBomSummary, upsertItems } from "./bomService.js";

const router = express.Router();
router.use(express.json());

function requireProject(body = {}) {
  const projectNumber = String(body.projectNumber || "").trim();
  const projectName = String(body.projectName || "").trim();
  if (!projectNumber || !projectName) {
    const err = new Error("project required");
    err.status = 400;
    throw err;
  }
  return { projectNumber, projectName };
}

router.post("/api/bom/get", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const parent = req.body.parent ? String(req.body.parent).trim() : null;
    if (parent) {
      const children = await getChildren(projectNumber, projectName, parent);
      return res.json({ parent, children });
    }
    const items = await loadBomSummary(projectNumber, projectName);
    return res.json({ items });
  } catch (err) {
    console.error("bom get error", err);
    res.status(err.status || 400).json({ error: err.message || "bom get failed" });
  }
});

router.post("/api/bom/upsert", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const parent = req.body.parent;
    const items = req.body.items || [];
    if (!parent) throw new Error("parent required");
    await upsertItems(projectNumber, projectName, parent, items);
    res.json({ ok: true });
  } catch (err) {
    console.error("bom upsert error", err);
    res.status(400).json({ error: err.message || "bom upsert failed" });
  }
});

router.post("/api/bom/tree", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const root = req.body.root;
    if (!root) throw new Error("root required");
    const tree = await buildTree(projectNumber, projectName, root);
    res.json({ tree });
  } catch (err) {
    console.error("bom tree error", err);
    res.status(400).json({ error: err.message || "bom tree failed" });
  }
});

export default router;
