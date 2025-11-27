import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const [, , key] = process.argv;
if (!key) { console.error('Usage: node scripts/get-r2.mjs <key>'); process.exit(1); }

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
});

const out = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
const text = await out.Body.transformToString();
let data;
try { data = JSON.parse(text); } catch { data = text; }

const tasks = Array.isArray(data?.tasks) ? data.tasks : (Array.isArray(data) ? data : []);
console.log(JSON.stringify({
  etag: out.ETag?.replaceAll('"',''),
  previewCount: tasks.length || (Array.isArray(data) ? data.length : 0),
  preview: tasks.slice(0, 3),
  rawType: Array.isArray(data?.tasks) ? 'wrapped' : (Array.isArray(data) ? 'array' : typeof data)
}, null, 2));
