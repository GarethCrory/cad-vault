import path from "path";
import fsp from "fs/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_TIMELINE_PATH = path.join(DATA_DIR, "timeline.json");

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT || process.env.R2_URL;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_TIMELINE_KEY = process.env.R2_TIMELINE_KEY || "timeline.json";

const r2Enabled = Boolean(R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

const s3 = r2Enabled ? new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
}) : null;

function normalizeTasks(payload){
  const arr = Array.isArray(payload?.tasks) ? payload.tasks : (Array.isArray(payload) ? payload : []);
  return arr;
}

async function streamToString(stream){
  if (!stream) return "";
  if (typeof stream.transformToString === "function") {
    return stream.transformToString();
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function loadLocalTimeline(){
  try{
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const raw = await fsp.readFile(LOCAL_TIMELINE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { tasks: normalizeTasks(parsed), source: "local" };
  }catch{
    return { tasks: [], source: "local" };
  }
}

export async function loadTimeline(){
  if (s3){
    try{
      const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: R2_TIMELINE_KEY }));
      const raw = await streamToString(res.Body);
      const parsed = raw ? JSON.parse(raw) : [];
      return { tasks: normalizeTasks(parsed), source: "r2" };
    }catch(err){
      console.warn("R2 timeline load failed, falling back to local file", err);
    }
  }
  return loadLocalTimeline();
}

export async function saveTimeline(tasks = []){
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const payload = { tasks: Array.isArray(tasks) ? tasks : [] };
  const body = JSON.stringify(payload, null, 2);
  await fsp.writeFile(LOCAL_TIMELINE_PATH, body, "utf8");

  if (s3){
    try{
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: R2_TIMELINE_KEY,
        Body: body,
        ContentType: "application/json"
      }));
      return { target: "r2" };
    }catch(err){
      console.error("R2 timeline save failed (local file was updated)", err);
      throw err;
    }
  }

  return { target: "local" };
}
