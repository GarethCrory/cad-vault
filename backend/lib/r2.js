import 'dotenv/config';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

function s3() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}
const Bucket = process.env.R2_BUCKET;

export async function getJson(Key){
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
  try{
    const out = await s3().send(new HeadObjectCommand({ Bucket, Key }));
    return { etag: out.ETag?.replaceAll('"','') };
  }catch(e){
    if(e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function putJson(Key, data){
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
