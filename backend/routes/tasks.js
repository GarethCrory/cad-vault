import express from "express";
import { nanoid } from "nanoid";
import { getJson, updateJsonCAS } from "../lib/r2.js";

const router = express.Router();
const tasksKey = (userId) => `tasks/${userId}.json`;

// list
router.post("/list", async (req, res) => {
  const userId = (req.body && req.body.userId) || "user-123";
  try {
    const { data, etag } = await getJson(tasksKey(userId));
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    return res.json({ tasks, etag });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to load tasks" });
  }
});

// add
router.post("/add", async (req, res) => {
  const userId = (req.body && req.body.userId) || "user-123";
  try {
    const now = new Date().toISOString();
    const t = {
      id: req.body.id || nanoid(8),
      title: req.body.title || "Untitled",
      status: req.body.status || "todo",
      priority: Number.isFinite(req.body.priority) ? req.body.priority : 0,
      clientId: req.body.clientId ?? null,
      clientName: req.body.clientName ?? null,
      projectNumber: req.body.projectNumber ?? null,
      projectName: req.body.projectName ?? null,
      dueDate: req.body.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    await updateJsonCAS(tasksKey(userId), (curr) => {
      const wrap = curr && typeof curr === "object" ? curr : { tasks: [] };
      if (!Array.isArray(wrap.tasks)) wrap.tasks = [];
      wrap.tasks.push(t);
      return wrap;
    });
    return res.json({ ok: true, task: t });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || "Failed to add task" });
  }
});

// update (partial)
router.post("/update", async (req, res) => {
  const userId = (req.body && req.body.userId) || "user-123";
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, message: "id is required" });
  try {
    let updated = null;
    await updateJsonCAS(tasksKey(userId), (curr) => {
      const wrap = curr && typeof curr === "object" ? curr : { tasks: [] };
      if (!Array.isArray(wrap.tasks)) wrap.tasks = [];
      const idx = wrap.tasks.findIndex(t => t.id === id);
      if (idx === -1) { throw Object.assign(new Error("Not found"), { status: 404 }); }
      const now = new Date().toISOString();
      const t = { ...wrap.tasks[idx] };

      if (typeof req.body.title === "string") t.title = req.body.title;
      if (typeof req.body.status === "string") t.status = req.body.status;
      if (Number.isFinite(req.body.priority)) t.priority = req.body.priority;
      if (typeof req.body.clientId !== "undefined") t.clientId = req.body.clientId;
      if (typeof req.body.clientName !== "undefined") t.clientName = req.body.clientName;
      if (typeof req.body.projectNumber !== "undefined") t.projectNumber = req.body.projectNumber;
      if (typeof req.body.projectName !== "undefined") t.projectName = req.body.projectName;
      if (typeof req.body.dueDate !== "undefined") t.dueDate = req.body.dueDate;

      t.updatedAt = now;
      t.version = (t.version || 1) + 1;

      wrap.tasks[idx] = t;
      updated = t;
      return wrap;
    });
    return res.json({ ok:true, task: updated });
  } catch (e) {
    const code = e.status || 500;
    return res.status(code).json({ ok:false, message: e.message || "Failed to update task" });
  }
});

// reorder (persist drag and drop)
router.post("/reorder", async (req, res) => {
  const userId = (req.body && req.body.userId) || "user-123";
  const order = Array.isArray(req.body.order) ? req.body.order : null;
  if (!order) return res.status(400).json({ ok:false, message: "order array is required" });
  try {
    const now = new Date().toISOString();
    await updateJsonCAS(tasksKey(userId), (curr) => {
      const wrap = curr && typeof curr === "object" ? curr : { tasks: [] };
      if (!Array.isArray(wrap.tasks)) wrap.tasks = [];
      const indexMap = new Map(order.map((id, i) => [id, i]));
      wrap.tasks.sort((a, b) => {
        const ai = indexMap.has(a.id) ? indexMap.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bi = indexMap.has(b.id) ? indexMap.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      wrap.tasks = wrap.tasks.map((t, i) => indexMap.has(t.id)
        ? { ...t, priority: i, updatedAt: now, version: (t.version || 1) + 1 }
        : t
      );
      return wrap;
    });
    return res.json({ ok:true });
  } catch (e) {
    return res.status(500).json({ ok:false, message: e.message || "Failed to reorder" });
  }
});

// delete (by id)
router.post("/delete", async (req, res) => {
  const userId = (req.body && req.body.userId) || "user-123";
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, message: "id is required" });
  try {
    let removed = null;
    await updateJsonCAS(tasksKey(userId), (curr) => {
      const wrap = curr && typeof curr === "object" ? curr : { tasks: [] };
      if (!Array.isArray(wrap.tasks)) wrap.tasks = [];
      const idx = wrap.tasks.findIndex(t => t.id === id);
      if (idx === -1) { throw Object.assign(new Error("Not found"), { status: 404 }); }
      removed = wrap.tasks[idx];
      wrap.tasks.splice(idx, 1);
      return wrap;
    });
    return res.json({ ok:true, removed });
  } catch (e) {
    const code = e.status || 500;
    return res.status(code).json({ ok:false, message: e.message || "Failed to delete task" });
  }
});

export default router;
