import { watch } from "chokidar";
import express from "express";
import open from "open";
import { resolve } from "node:path";
import { loadProject, regionSize } from "./project.js";
import { renderWidget } from "./liquid.js";

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function serveProject(root = process.cwd(), port = 7341, shouldOpen = true) {
  const projectRoot = resolve(root);
  const app = express();
  const clients = new Set<express.Response>();
  let revision = 0;

  app.get("/events", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    clients.add(res);
    res.write(`event: ready\ndata: ${revision}\n\n`);
    res.on("close", () => clients.delete(res));
  });

  app.get("/", async (_req, res) => {
    try {
      const project = await loadProject(projectRoot);
      const cards = await Promise.all(project.preview.spans.map(async (span) => {
        const size = regionSize(project.preview, span.columns, span.rows);
        const fragment = await renderWidget(
          project.template,
          project.widget,
          project.preview,
          project.fixture,
          span.columns,
          span.rows,
        );
        return `<article class="preview-card">
          <header><strong>${span.columns}×${span.rows}</strong><span>${size.width}×${size.height}px</span></header>
          <div class="scale-box"><iframe title="${span.columns}x${span.rows}" src="/preview/${span.columns}/${span.rows}"></iframe></div>
        </article>`;
      }));

      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(project.widget.name)} · OpenDisplay Studio</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#111;color:#eee;font:14px system-ui,sans-serif} header.top{padding:18px 24px;border-bottom:1px solid #333;position:sticky;top:0;background:#111;z-index:2}.meta{opacity:.65;margin-top:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px;padding:24px}.preview-card{background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:12px}.preview-card>header{display:flex;justify-content:space-between;margin-bottom:10px}.preview-card>header span{opacity:.65}.scale-box{background:#2b2b2b;padding:14px;overflow:auto;min-height:200px}.scale-box iframe{border:0;display:block;transform-origin:top left;max-width:none;background:white;width:100%;height:320px}
      </style></head><body><header class="top"><strong>${escapeHtml(project.widget.name)}</strong><div class="meta">${project.preview.display.name} · ${project.preview.display.width}×${project.preview.display.height} · grid ${project.preview.display.columns}×${project.preview.display.rows} · Framework ${project.widget.framework}</div></header><main class="grid">${cards.join("")}</main>
      <script>const es=new EventSource('/events');let first=true;es.addEventListener('ready',()=>{if(first){first=false;return;}location.reload()});es.addEventListener('reload',()=>location.reload());</script></body></html>`);
    } catch (error) {
      res.status(500).type("html").send(`<pre style="white-space:pre-wrap;color:#b00020">${escapeHtml(error instanceof Error ? error.stack ?? error.message : error)}</pre>`);
    }
  });

  app.get("/preview/:columns/:rows", async (req, res) => {
    try {
      const project = await loadProject(projectRoot);
      const columns = Number(req.params.columns);
      const rows = Number(req.params.rows);
      const size = regionSize(project.preview, columns, rows);
      const fragment = await renderWidget(project.template, project.widget, project.preview, project.fixture, columns, rows);
      const version = encodeURIComponent(project.widget.framework);
      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${size.width},initial-scale=1">
      <link rel="stylesheet" href="https://trmnl.com/css/${version}/plugins.css">
      <style>html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff}.od-region{width:100%;height:100%;overflow:hidden;container-type:size}.od-region>.item{width:100%!important;height:100%!important;margin:0!important}</style></head>
      <body><section class="screen screen--md screen--1bit" style="width:${size.width}px;height:${size.height}px"><div class="od-region">${fragment}</div></section>
      <script src="https://trmnl.com/js/${version}/plugins.js"></script><script>window.addEventListener('load',async()=>{if(typeof window.terminalize==='function')await window.terminalize();});</script></body></html>`);
    } catch (error) {
      res.status(500).type("text").send(error instanceof Error ? error.stack ?? error.message : String(error));
    }
  });

  const server = app.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`OpenDisplay Studio preview: ${url}`);
    if (shouldOpen) void open(url);
  });

  const watcher = watch(["widget.yml", "preview.yml", "*.liquid", "fixtures/**/*"], { cwd: projectRoot, ignoreInitial: true });
  watcher.on("all", (_event, path) => {
    revision += 1;
    console.log(`Changed: ${path}`);
    for (const client of clients) client.write(`event: reload\ndata: ${revision}\n\n`);
  });

  const close = async () => {
    await watcher.close();
    for (const client of clients) client.end();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  };
  process.once("SIGINT", () => void close().then(() => process.exit(0)));
  process.once("SIGTERM", () => void close().then(() => process.exit(0)));
  return { server, close };
}
