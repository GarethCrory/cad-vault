export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}
export function bad(msg, code = 400) { return json({ ok:false, error:String(msg) }, code); }
