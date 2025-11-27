import 'dotenv/config';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const [, , key] = process.argv;
if (!key) { console.error('Usage: node scripts/head-r2.mjs <key>'); process.exit(1); }

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
});

try {
  const out = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  console.log(JSON.stringify({
    exists: true,
    etag: out.ETag?.replaceAll('"',''),
    size: out.ContentLength,
    contentType: out.ContentType
  }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ exists: false, status: e.$metadata?.httpStatusCode || 0, message: e.message }, null, 2));
  process.exit(1);
}
