var index_default = {
    async fetch(request, env) {
        const url = new URL(request.url);
        const host = request.headers.get("host");
        const pathParts = url.pathname.split("/").filter(p => p !== "");
        const firstPart = pathParts[0];
        const INDEX_KEY = "__dashboard_index__";

        const toSafeKey = (value) => typeof value === "string" ? value.trim() : "";

        const normalizeIndex = (raw) => ({
            links: Array.isArray(raw?.links) ? [...new Set(raw.links.map(toSafeKey).filter(Boolean))] : [],
            pastes: Array.isArray(raw?.pastes) ? [...new Set(raw.pastes.map(toSafeKey).filter(Boolean))] : []
        });

        const getIndex = async () => {
            try {
                const raw = await env.SHORTENER_DB.get(INDEX_KEY, { type: "json", cacheTtl: 0 });
                return normalizeIndex(raw);
            } catch (error) {
                // Fallback for corrupted index JSON to avoid crashing admin actions.
                console.error("Failed to parse dashboard index, rebuilding", error);
                return rebuildIndexFromList();
            }
        };

        const putIndex = async (index) => {
            await env.SHORTENER_DB.put(INDEX_KEY, JSON.stringify(normalizeIndex(index)));
        };

        const rebuildIndexFromList = async () => {
            const list = await env.SHORTENER_DB.list();
            const rebuilt = { links: [], pastes: [] };
            for (const item of list.keys) {
                if (item.name === INDEX_KEY) continue;
                if (item.name.startsWith("paste:")) rebuilt.pastes.push(item.name.replace("paste:", ""));
                else rebuilt.links.push(item.name);
            }
            await putIndex(rebuilt);
            return rebuilt;
        };

        const isLnkDomain = host === "lnk.jumpow.de";
        const isAdminPath = ["admin", "add", "del", "addpaste", "delpaste"].includes(firstPart);

        // --- 1. ADMIN LOGIC ---
        if (isLnkDomain || isAdminPath) {
            let action = firstPart;
            if (isLnkDomain && !isAdminPath) action = "admin";

            if (action === "admin") {
                let index = await getIndex();
                if (!index.links.length && !index.pastes.length) {
                    index = await rebuildIndexFromList();
                }

                let linkRows = "";
                let pasteRows = "";

                for (const linkKey of index.links) {
                    const val = await env.SHORTENER_DB.get(linkKey, { cacheTtl: 0 });
                    if (!val) continue;
                    const linkKeyEncoded = encodeURIComponent(linkKey);
                    linkRows += `
                        <div class="item-row">
                            <div style="min-width: 0; flex: 1;">
                                <div class="item-link">grueneeule.de/${linkKey}</div>
                                <div class="item-val">${val}</div>
                            </div>
                            <a href="/del?key=${linkKeyEncoded}" class="btn-del">Delete</a>
                        </div>`;
                }

                for (const pasteKey of index.pastes) {
                    const val = await env.SHORTENER_DB.get("paste:" + pasteKey, { cacheTtl: 0 });
                    if (!val || typeof val !== "string") continue;
                    const pasteKeyEncoded = encodeURIComponent(pasteKey);
                    pasteRows += `
                        <div class="item-row">
                            <div style="min-width: 0; flex: 1;">
                                <div class="item-link">grueneeule.de/p/${pasteKey}</div>
                                <div class="item-val">${val.substring(0, 50)}${val.length > 50 ? '...' : ''}</div>
                            </div>
                            <a href="/delpaste?key=${pasteKeyEncoded}" class="btn-del">Delete</a>
                        </div>`;
                }

                return new Response(`
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
              .tabs { display: flex; gap: 20px; border-bottom: 1px solid #313131; margin-bottom: 24px; }
              .tab { padding: 10px 0; cursor: pointer; color: #666; font-weight: 500; border-bottom: 2px solid transparent; }
              .tab.active { color: #0070f3; border-bottom-color: #0070f3; }
              .tab-content { display: none; }
              .tab-content.active { display: block; }
              input, textarea { background: #000; border: 1px solid #313131; color: #fff; padding: 10px; border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
              textarea { height: 100px; resize: vertical; }
              button { background: #0070f3; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; font-weight: 500; cursor: pointer; }
              .item-row { background: #1a1a1a; padding: 12px 16px; border: 1px solid #313131; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
              .item-link { color: #0070f3; font-weight: 500; font-size: 14px; }
              .item-val { color: #999; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 350px; }
              .btn-del { color: #f04f4f; text-decoration: none; font-size: 12px; padding: 4px 8px; border: 1px solid #313131; border-radius: 4px; background: #222; }
              .help-btn { background: #222; border: 1px solid #313131; color: #999; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: auto; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 style="font-size: 20px; font-weight: 500; margin-bottom: 24px;">grueneeule.de <span style="color: #666;">/ Dashboard</span></h1>
              
              <div class="tabs">
                <div class="tab active" onclick="openTab(event, 'tab-links')">Shortener</div>
                <div class="tab" onclick="openTab(event, 'tab-paste')">Pastebin</div>
              </div>

              <div id="tab-links" class="tab-content active">
                <div class="help-btn" onclick="alert('/add: Erstellt einen neuen Shortlink (Key -> Ziel-URL).\\nBeispiel: /add?key=discord&url=https://discord.gg/deinserver\\n\\n/del: Loescht einen vorhandenen Shortlink per Key.\\nBeispiel: /del?key=discord')">?</div>
                <div class="card">
                  <form action="/add" method="GET" style="display: flex; gap: 10px; align-items: flex-end;">
                    <div style="flex:1"><label style="font-size:12px;color:#999">Key</label><input type="text" name="key" required></div>
                    <div style="flex:2"><label style="font-size:12px;color:#999">Target URL</label><input type="url" name="url" required></div>
                    <button type="submit">Add Link</button>
                  </form>
                </div>
                ${linkRows || '<p style="color:#666;text-align:center;">No links found.</p>'}
              </div>

              <div id="tab-paste" class="tab-content">
                <div class="card">
                  <form action="/addpaste" method="POST">
                    <label style="font-size:12px;color:#999">Paste Key</label>
                    <input type="text" name="key" placeholder="my-note" required>
                    <label style="font-size:12px;color:#999">Content</label>
                    <textarea name="content" placeholder="Paste your text here..." required></textarea>
                    <button type="submit">Save Paste</button>
                  </form>
                </div>
                ${pasteRows || '<p style="color:#666;text-align:center;">No pastes found.</p>'}
              </div>
            </div>

            <script>
              function openTab(evt, tabName) {
                var i, content, tabs;
                content = document.getElementsByClassName("tab-content");
                for (i = 0; i < content.length; i++) content[i].classList.remove("active");
                tabs = document.getElementsByClassName("tab");
                for (i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
                document.getElementById(tabName).classList.add("active");
                evt.currentTarget.classList.add("active");
              }
            </script>
          </body>
          </html>`, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store, no-cache, must-revalidate" } });
            }

            // Logic for adding/deleting
            if (action === "add") {
                const p = url.searchParams;
                const key = toSafeKey(p.get("key"));
                const target = toSafeKey(p.get("url"));
                if (key && target) {
                    await env.SHORTENER_DB.put(key, target);
                    const index = await getIndex();
                    if (!index.links.includes(key)) {
                        index.links.push(key);
                        await putIndex(index);
                    }
                }
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
            if (action === "del") {
                const k = toSafeKey(url.searchParams.get("key"));
                if (k) {
                    await env.SHORTENER_DB.delete(k);
                    const index = await getIndex();
                    index.links = index.links.filter(item => item !== k);
                    await putIndex(index);
                }
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
            if (action === "addpaste") {
                const formData = await request.formData();
                const k = toSafeKey(formData.get("key"));
                const c = typeof formData.get("content") === "string" ? formData.get("content") : "";
                if (k && c) {
                    await env.SHORTENER_DB.put("paste:" + k, c);
                    const index = await getIndex();
                    if (!index.pastes.includes(k)) {
                        index.pastes.push(k);
                        await putIndex(index);
                    }
                }
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
            if (action === "delpaste") {
                const k = toSafeKey(url.searchParams.get("key"));
                if (k) {
                    await env.SHORTENER_DB.delete("paste:" + k);
                    const index = await getIndex();
                    index.pastes = index.pastes.filter(item => item !== k);
                    await putIndex(index);
                }
                return Response.redirect(url.origin + (isLnkDomain ? "/" : "/admin"), 302);
            }
        }

        // --- 2. PUBLIC VIEWS ---

        // RAW PASTEBIN VIEW (grueneeule.de/p/raw/key)
        if (firstPart === "p" && pathParts[1] === "raw" && pathParts[2]) {
            const pasteContent = await env.SHORTENER_DB.get("paste:" + pathParts[2]);
            if (pasteContent) {
                return new Response(pasteContent, { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
            }
        }

        // PASTEBIN VIEW (grueneeule.de/p/key)
        if (firstPart === "p" && pathParts[1]) {
            const pasteKey = pathParts[1];
            const pasteContent = await env.SHORTENER_DB.get("paste:" + pasteKey);
            if (pasteContent) {
                const escapedKey = pasteKey.replace(/&/g, "&amp;").replace(/</g, "&lt;");
                const escapedContent = pasteContent.replace(/&/g, "&amp;").replace(/</g, "&lt;");
                const rawLink = `/p/raw/${encodeURIComponent(pasteKey)}`;

                return new Response(`<!DOCTYPE html><html lang="en"><head><title>Paste | grueneeule.de</title><style>body{background:#000;color:#ccc;font-family:monospace;padding:40px;line-height:1.5;white-space:pre-wrap;word-break:break-all;} .meta{display:flex;justify-content:space-between;align-items:center;gap:12px;color:#0070f3;margin-bottom:20px;border-bottom:1px solid #313131;padding-bottom:10px;} .actions{display:flex;gap:8px;} .action-btn{background:#111;color:#ccc;border:1px solid #313131;padding:6px 10px;border-radius:4px;cursor:pointer;font-family:inherit;text-decoration:none;font-size:13px;} .action-btn:hover{border-color:#0070f3;color:#fff;} #paste-content{margin:0;}</style></head><body><div class="meta"><span>Paste: ${escapedKey}</span><div class="actions"><button id="copy-btn" class="action-btn" type="button">Copy text</button><a class="action-btn" href="${rawLink}">Raw</a></div></div><pre id="paste-content">${escapedContent}</pre><script>document.getElementById("copy-btn").addEventListener("click", async function(){const text = document.getElementById("paste-content").textContent || ""; try { await navigator.clipboard.writeText(text); this.textContent = "Copied"; setTimeout(() => this.textContent = "Copy text", 1200); } catch (e) { this.textContent = "Copy failed"; setTimeout(() => this.textContent = "Copy text", 1200); }});</script></body></html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
            }
        }

        // SHORTENER REDIRECT
        if (!firstPart) return Response.redirect("https://jumpstone4477.de", 302);
        const targetURL = await env.SHORTENER_DB.get(firstPart);
        if (targetURL) return Response.redirect(targetURL, 302);

        // 404
        return new Response("404 Not Found", { status: 404 });
    }
};

export { index_default as default };
