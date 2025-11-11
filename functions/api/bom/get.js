const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json" }});
export const onRequestPost = async () => {
  return json({ success:true, items:[] }); // placeholder BOM
};
