export default {
  async fetch(request, env, ctx) {
    // route /api/* to corresponding function if exists
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const route = url.pathname.replace("/api/", "");
      try {
        const module = await import(`./api/${route}.js`);
        const method = `onRequest${request.method[0].toUpperCase()}${request.method.slice(1).toLowerCase()}`;
        if (module[method]) {
          return module[method]({ request, env, ctx });
        }
        return new Response("Method not allowed", { status: 405 });
      } catch (e) {
        return new Response("Function not found", { status: 404 });
      }
    }

    return new Response("OK", { status: 200 });
  },
};
