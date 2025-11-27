import 'dotenv/config';
import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const [,, key, filePath] = process.argv;
if (!key || !filePath) {
  console.error('Usage: node scripts/put-r2.mjs <key> <local-json-path>');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const Body = readFileSync(filePath, 'utf8');
const Bucket = process.env.R2_BUCKET;

const out = await s3.send(new PutObjectCommand({
  Bucket, Key: key, Body, ContentType: 'application/json'
}));
console.log('Uploaded', key, 'ETag:', out.ETag);
