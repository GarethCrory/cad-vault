export const onRequestPost = async ({ request }) => {
  const body = await request.json().catch(()=> ({}));
  return new Response(JSON.stringify({ ok:true, releaseId: Date.now(), input: body }), { headers:{ "content-type":"application/json" }});
};
