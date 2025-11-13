import express from "express";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import crypto from "crypto";

const router = express.Router();
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const sessions = new Map();

function safeLower(str = "") {
  return String(str || "").trim().toLowerCase();
}

async function ensureUsersFile() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(USERS_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(USERS_FILE, "[]", "utf8");
  }
}

async function loadUsers() {
  await ensureUsersFile();
  try {
    const raw = await fsp.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveUsers(users = []) {
  await ensureUsersFile();
  await fsp.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hashed = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hashed}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, original] = storedHash.split(":");
  if (!salt || !original) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(original, "hex"),
      Buffer.from(derived, "hex")
    );
  } catch {
    return false;
  }
}

async function ensureDefaultAdmin() {
  const users = await loadUsers();
  if (users.length > 0) return;
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "vault123";
  const admin = {
    id: crypto.randomUUID(),
    name: "Admin",
    email: "admin@cadvault.local",
    role: "admin",
    passwordHash: hashPassword(defaultPassword)
  };
  await saveUsers([admin]);
  console.log(
    "[auth] Created default admin user admin@cadvault.local / vault123 (override via DEFAULT_ADMIN_PASSWORD)"
  );
}

function scrubUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const session = {
    token,
    user: scrubUser(user),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  sessions.set(token, session);
  return session;
}

function getSession(token) {
  if (!token) return null;
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return entry;
}

function extractToken(req) {
  const header = req.headers?.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const token = req.body?.token || req.query?.token;
  return token || null;
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const users = await loadUsers();
  const user = users.find((u) => safeLower(u.email) === safeLower(email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const session = createSession(user);
  res.json({ ok: true, token: session.token, user: session.user });
});

router.post("/logout", (req, res) => {
  const token = extractToken(req);
  if (token) {
    sessions.delete(token);
  }
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = extractToken(req);
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Unauthorised" });
  }
  res.json({ ok: true, user: session.user });
});

function authMiddleware(req, res, next) {
  if (req.method === "OPTIONS") return next();
  if (!req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/auth/")) return next();
  const session = getSession(extractToken(req));
  if (!session) {
    return res.status(401).json({ error: "Unauthorised" });
  }
  req.user = session.user;
  return next();
}

export { authMiddleware, ensureDefaultAdmin };
export default router;
