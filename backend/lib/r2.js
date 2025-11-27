import "dotenv/config";
import path from "path";
import fsp from "fs/promises";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const hasR2 =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_BUCKET &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY;

function s3() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
  });
}
const Bucket = process.env.R2_BUCKET;

const DATA_ROOT = path.join(process.cwd(), "data", "tasks-cache");

function localPath(Key = "") {
  const safeKey = Key.replace(/^\/*/, "");
  return path.join(DATA_ROOT, safeKey);
}

async function ensureDirFor(Key) {
  const dir = path.dirname(localPath(Key));
  await fsp.mkdir(dir, { recursive: true });
}

export async function getJson(Key){
  if (!hasR2) {
    try{
      const raw = await fsp.readFile(localPath(Key), "utf8");
      return { data: JSON.parse(raw), etag: null };
    }catch(err){
      if (err.code === "ENOENT") return { data: null, etag: null };
      throw err;
    }
  }
  try{
    const out = await s3().send(new GetObjectCommand({ Bucket, Key }));
    const text = await out.Body.transformToString();
    return { data: JSON.parse(text), etag: out.ETag?.replaceAll('"','') };
  }catch(e){
    if(e.$metadata?.httpStatusCode === 404) return { data:null, etag:null };
    throw e;
  }
}

export async function head(Key){
  if (!hasR2) {
    try{
      const st = await fsp.stat(localPath(Key));
      return { etag: String(st.mtimeMs) };
    }catch(err){
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }
  try{
    const out = await s3().send(new HeadObjectCommand({ Bucket, Key }));
    return { etag: out.ETag?.replaceAll('"','') };
  }catch(e){
    if(e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function putJson(Key, data){
  if (!hasR2) {
    await ensureDirFor(Key);
    const Body = JSON.stringify(data, null, 2);
    await fsp.writeFile(localPath(Key), Body, "utf8");
    const st = await fsp.stat(localPath(Key));
    return { etag: String(st.mtimeMs) };
  }
  const Body = JSON.stringify(data);
  const out = await s3().send(new PutObjectCommand({ Bucket, Key, Body, ContentType:"application/json" }));
  return { etag: out.ETag?.replaceAll('"','') };
}

export async function updateJsonCAS(Key, updater){
  const { data, etag } = await getJson(Key);
  const next = await updater(data ?? null);
  const h = await head(Key);
  if((etag || h?.etag) && h && h.etag !== etag){
    const err = new Error("Precondition failed"); err.status = 412; throw err;
  }
  return putJson(Key, next);
}
