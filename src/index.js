var index_default = {
    async fetch(request, env) {
        const url = new URL(request.url);
        const host = request.headers.get("host");
        const key = url.pathname.split("/")[1];

        // Admin tools can be reached either via explicit paths or the dedicated admin domain.
        const isAdminPath = ["admin", "add", "del"].includes(key);
        const isLnkDomain = host === "lnk.jumpow.de";

        // Handle admin dashboard and admin actions first.
        if (isLnkDomain || isAdminPath) {
            let action = key;
            // Visiting the admin domain root should open the dashboard directly.
            if (isLnkDomain && !isAdminPath) {
                action = "admin";
            }

            if (action === "admin") {
                const list = await env.SHORTENER_DB.list();
                let rows = "";
                // Build one UI row per stored short link.
                for (const item of list.keys) {
                    // Resolve each key to its target so the dashboard shows both values.
                    const val = await env.SHORTENER_DB.get(item.name);
                    rows += `
            <div style="background: #1a1a1a; padding: 12px 16px; border: 1px solid #313131; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <div style="min-width: 0; flex-grow: 1; margin-right: 15px;">
                <div style="color: #0070f3; font-weight: 500; font-size: 14px;">grueneeule.de/${item.name}</div>
                <div style="color: #999; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">${val}</div>
              </div>
              <a href="/del?key=${item.name}" style="color: #f04f4f; text-decoration: none; font-size: 12px; padding: 4px 8px; border: 1px solid #313131; border-radius: 4px; background: #222;">Delete</a>
            </div>`;
                }

                // Keep the admin page self-contained so it works without extra assets.
                const htmlAdmin = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin | grueneeule.de</title>
            <style>
              body { font-family: "Inter", sans-serif; background: #000; color: #fff; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
              .container { width: 100%; max-width: 800px; position: relative; }
              .card { background: #111; border: 1px solid #313131; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
              input { background: #000; border: 1px solid #313131; color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; }
              button { background: #0070f3; color: #fff; border: none; padding: 10px 16px; border-radius: 4px; font-weight: 500; cursor: pointer; }
              .help-btn { position: absolute; top: 0; right: 0; background: #222; border: 1px solid #313131; color: #999; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
              .help-btn:hover { color: #fff; border-color: #666; }
              
              #modal { display: none; position: fixed; z-index: 100; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8); backdrop-filter: blur(4px); }
              .modal-content { background: #111; border: 1px solid #313131; margin: 15% auto; padding: 24px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
              .modal-header { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #0070f3; }
              .modal-body { font-size: 14px; color: #ccc; line-height: 1.6; }
              code { background: #222; padding: 2px 5px; border-radius: 4px; color: #e67e22; }
              .close-btn { float: right; cursor: pointer; color: #666; font-size: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <button class="help-btn" onclick="document.getElementById('modal').style.display='block'">?</button>
              <h1 style="font-size: 20px; font-weight: 500; margin-bottom: 24px;">grueneeule.de <span style="color: #666;">/ Dashboard</span></h1>
              
              <div class="card">
                <form action="/add" method="GET" style="display: flex; gap: 12px; align-items: flex-end;">
                  <div style="flex: 1;"><label style="font-size:12px;color:#999;">Key</label><input type="text" name="key" required></div>
                  <div style="flex: 2;"><label style="font-size:12px;color:#999;">URL</label><input type="url" name="url" required></div>
                  <button type="submit">Add</button>
                </form>
              </div>

              <div class="card">
                <div style="font-size:14px; margin-bottom:16px;">Active Links</div>
                ${rows || '<p style="color:#666;text-align:center;">No links available.</p>'}
              </div>

              <div id="modal" onclick="if(event.target == this) this.style.display='none'">
                <div class="modal-content">
                  <span class="close-btn" onclick="document.getElementById('modal').style.display='none'">&times;</span>
                  <div class="modal-header">API Documentation</div>
                  <div class="modal-body">
                    <p>Control via URLs:</p>
                    <b>1. Add (<code>/add</code>):</b><br>
                    <code>?key=NAME&url=TARGET</code>
                    <br><br>
                    <b>2. Delete (<code>/del</code>):</b><br>
                    <code>?key=NAME</code>
                  </div>
                </div>
              </div>
            </div>
          </body>
          </html>`;
                return new Response(htmlAdmin, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
            }

            if (action === "add") {
                const p = url.searchParams;
                // Save a short key -> target URL mapping from query params.
                if (p.get("key") && p.get("url")) await env.SHORTENER_DB.put(p.get("key"), p.get("url"));
                // After writing, return to the dashboard that matches the current host.
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
            if (action === "del") {
                const k = url.searchParams.get("key");
                // Remove a mapping when a key is provided.
                if (k) await env.SHORTENER_DB.delete(k);
                // Keep UX consistent by returning to the same admin entry point.
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
        }

        // Public redirect flow.
        if (!key || key === "") return Response.redirect("https://jumpstone4477.de", 302);
        // Look up the short key in KV and redirect when a match exists.
        const targetURL = await env.SHORTENER_DB.get(key);
        if (targetURL) return Response.redirect(targetURL, 302);
        // Return a dashboard-styled HTML 404 page for unknown keys.
        const html404 = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>404 | grueneeule.de</title>
          <style>
            body { font-family: "Inter", sans-serif; background: #000; color: #fff; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
            .container { width: 100%; max-width: 620px; }
            .card { background: #111; border: 1px solid #313131; border-radius: 12px; padding: 30px; }
            .eyebrow { color: #0070f3; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 14px; }
            h1 { margin: 0 0 10px; font-size: 32px; line-height: 1.2; }
            p { margin: 0; color: #a0a0a0; font-size: 15px; line-height: 1.6; }
            .key { margin-top: 18px; padding: 10px 12px; border-radius: 8px; border: 1px solid #313131; background: #0a0a0a; color: #d0d0d0; font-size: 13px; word-break: break-all; }
            .actions { margin-top: 22px; display: flex; gap: 10px; flex-wrap: wrap; }
            .btn { display: inline-block; text-decoration: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; border: 1px solid #313131; }
            .btn-primary { background: #0070f3; border-color: #0070f3; color: #fff; }
            .btn-secondary { background: #1a1a1a; color: #cfcfcf; }
          </style>
        </head>
        <body>
          <main class="container">
            <section class="card">
              <div class="eyebrow">404 - Link not found</div>
              <h1>This short link does not exist.</h1>
              <p>The requested link was not found or may have been removed. Check the key or create it again in the dashboard.</p>
              <div class="key">Requested key: /${key}</div>
              <div class="actions">
                <a class="btn btn-primary" href="https://grueneeule.de">Go to homepage</a>
              </div>
            </section>
          </main>
        </body>
        </html>`;
        return new Response(html404, { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
};

export { index_default as default };