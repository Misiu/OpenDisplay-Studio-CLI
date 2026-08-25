import { watch } from "chokidar";
import express from "express";
import open from "open";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadProject, regionSizeForViewport } from "./project.js";
import { renderWidget } from "./liquid.js";

const PICKER_DIST = fileURLToPath(new URL("../node_modules/@trmnl/picker/dist/", import.meta.url));

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function intParam(value: unknown, fallback: number, min = 1, max = 4096) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function safeClasses(value: unknown) {
  return String(value ?? "")
    .split(/\s+/)
    .filter((item) => /^[a-zA-Z0-9_-]+$/.test(item));
}

export async function serveProject(root = process.cwd(), port = 7341, shouldOpen = true) {
  const projectRoot = resolve(root);
  const app = express();
  const clients = new Set<express.Response>();
  let revision = 0;

  app.use("/vendor/trmnl-picker", express.static(PICKER_DIST));

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
      const cards = project.preview.spans.map((span, index) => `
        <article class="preview-card" data-preview-card data-columns="${span.columns}" data-rows="${span.rows}" data-index="${index}">
          <header><strong>${span.columns}×${span.rows}</strong><span data-size-label>—</span></header>
          <div class="preview-surface" data-preview-surface>
            <div class="preview-stage" data-preview-stage>
              <iframe data-preview-frame title="${span.columns}x${span.rows}"></iframe>
            </div>
          </div>
        </article>`).join("");

      const config = {
        framework: project.widget.framework,
        defaultModel: project.preview.display.model,
        defaultPalette: project.preview.display.palette,
        columns: project.preview.display.columns,
        rows: project.preview.display.rows,
        gap: project.preview.display.gap ?? null,
      };

      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(project.widget.name)} · OpenDisplay Studio</title>
      <style>
        *{box-sizing:border-box} :root{color-scheme:dark} body{margin:0;background:#111;color:#eee;font:14px system-ui,-apple-system,Segoe UI,sans-serif}
        .top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:16px 20px;border-bottom:1px solid #303030;position:sticky;top:0;background:#111;z-index:5}.title{font-weight:700}.meta{opacity:.62;margin-top:3px;font-size:12px}
        .controls{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:1000px}.control{display:grid;gap:3px}.control>span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.55}.control select,.control input,.control button{height:31px;border:1px solid #444;border-radius:6px;background:#1c1c1c;color:#eee;padding:0 8px;font:12px inherit}.control select{min-width:145px}.control.small select,.control.small input{min-width:68px;width:78px}.segmented{display:flex;border:1px solid #444;border-radius:6px;overflow:hidden;height:31px}.segmented button{border:0;border-right:1px solid #444;border-radius:0;height:29px;background:#1c1c1c;color:#aaa;padding:0 10px}.segmented button:last-child{border-right:0}.segmented button.active{background:#eee;color:#111}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(390px,1fr));gap:18px;padding:20px}.preview-card{min-width:0;background:#191919;border:1px solid #343434;border-radius:10px;padding:10px}.preview-card[hidden]{display:none}.preview-card>header{display:flex;justify-content:space-between;margin-bottom:8px}.preview-card>header span{opacity:.6;font-variant-numeric:tabular-nums}.preview-surface{height:350px;display:flex;align-items:center;justify-content:center;background:#292929;border-radius:4px;overflow:hidden;padding:10px}.preview-stage{position:relative;flex:none}.preview-stage iframe{position:absolute;left:0;top:0;border:0;background:white;transform-origin:top left;max-width:none}
        .error{margin:20px;padding:14px;border:1px solid #8b3030;background:#2b1616;color:#ffb1b1;border-radius:8px;white-space:pre-wrap}
        @media(max-width:900px){.top{position:static;display:block}.controls{justify-content:flex-start;margin-top:12px}.grid{grid-template-columns:1fr}}
      </style></head><body>
      <header class="top"><div><div class="title">${escapeHtml(project.widget.name)}</div><div class="meta"><span data-device-summary>Loading device…</span> · grid <span data-grid-summary>${config.columns}×${config.rows}</span> · Framework ${escapeHtml(project.widget.framework)}</div></div>
      <form id="picker-form" class="controls">
        <label class="control"><span>Device</span><select data-model-select></select></label>
        <label class="control"><span>Palette</span><select data-palette-select></select></label>
        <div class="control"><span>Theme</span><div class="segmented"><button type="button" data-dark-mode-toggle><span data-dark-mode-text>Light</span></button></div></div>
        <div class="control"><span>Orientation</span><div class="segmented"><button type="button" data-orientation-toggle><span data-orientation-text>Landscape</span></button></div></div>
        <label class="control"><span>Color mode</span><select id="color-mode"><option value="raw">Raw</option><option value="preview" selected>Preview</option></select></label>
        <label class="control"><span>Font family</span><select id="font-family"><option value="default">Default</option><option value="classic">Classic</option><option value="trmnl">TRMNL</option></select></label>
        <label class="control"><span>Text scale</span><select id="text-scale"><option value="small">Small</option><option value="regular" selected>Regular</option><option value="large">Large</option><option value="xlarge">XLarge</option></select></label>
        <label class="control small"><span>Grid cols</span><input id="grid-columns" type="number" min="1" max="12" value="${config.columns}"></label>
        <label class="control small"><span>Grid rows</span><input id="grid-rows" type="number" min="1" max="12" value="${config.rows}"></label>
        <div class="control"><span>&nbsp;</span><button type="button" data-reset-button>Reset</button></div>
      </form></header>
      <main class="grid">${cards}</main>
      <script>window.__ODSTUDIO_CONFIG__=${safeJson(config)};</script>
      <script type="module">
        import TRMNLPicker from '/vendor/trmnl-picker/trmnl-picker.esm.js';
        const cfg=window.__ODSTUDIO_CONFIG__;
        const form=document.getElementById('picker-form');
        const colorMode=document.getElementById('color-mode');
        const fontFamily=document.getElementById('font-family');
        const textScale=document.getElementById('text-scale');
        const gridColumns=document.getElementById('grid-columns');
        const gridRows=document.getElementById('grid-rows');
        const cards=[...document.querySelectorAll('[data-preview-card]')];
        let picker;

        const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
        const gridValue=(input,fallback)=>{const n=Number(input.value);return Number.isInteger(n)&&n>=1&&n<=12?n:fallback};
        const regionSize=(width,height,columns,rows)=>{
          const gc=gridValue(gridColumns,cfg.columns),gr=gridValue(gridRows,cfg.rows);
          const gap=cfg.gap??clamp(Math.round(Math.min(width,height)/60),3,10);
          const cellWidth=(width-gap*(gc+1))/gc,cellHeight=(height-gap*(gr+1))/gr;
          return {width:Math.round(cellWidth*columns+gap*(columns-1)),height:Math.round(cellHeight*rows+gap*(rows-1)),gap,gc,gr};
        };
        const extraClasses=()=>{
          const result=[];
          if(colorMode.value==='preview') result.push('screen--preview-colors');
          if(fontFamily.value==='classic') result.push('screen--fonts-classic');
          if(fontFamily.value==='trmnl') result.push('screen--fonts-trmnl');
          if(textScale.value!=='regular') result.push('screen--text-scale-'+textScale.value);
          return result;
        };
        const fitCard=(card,width,height)=>{
          const surface=card.querySelector('[data-preview-surface]');
          const stage=card.querySelector('[data-preview-stage]');
          const frame=card.querySelector('[data-preview-frame]');
          const availableWidth=Math.max(1,surface.clientWidth-20),availableHeight=Math.max(1,surface.clientHeight-20);
          const scale=Math.min(1,availableWidth/width,availableHeight/height);
          stage.style.width=(width*scale)+'px';stage.style.height=(height*scale)+'px';
          frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';
        };
        const refresh=()=>{
          if(!picker)return;
          const state=picker.state;
          const gc=gridValue(gridColumns,cfg.columns),gr=gridValue(gridRows,cfg.rows);
          document.querySelector('[data-grid-summary]').textContent=gc+'×'+gr;
          document.querySelector('[data-device-summary]').textContent=(state.model.label||state.model.name)+' · '+state.width+'×'+state.height+' · '+state.palette.name;
          const classes=[...state.screenClasses,...extraClasses()];
          for(const card of cards){
            const columns=Number(card.dataset.columns),rows=Number(card.dataset.rows);
            if(columns>gc||rows>gr){card.hidden=true;continue} card.hidden=false;
            const size=regionSize(state.width,state.height,columns,rows);
            card.querySelector('[data-size-label]').textContent=size.width+'×'+size.height+'px';
            const frame=card.querySelector('[data-preview-frame]');
            const params=new URLSearchParams({dw:String(state.width),dh:String(state.height),gc:String(gc),gr:String(gr),screen_classes:classes.join(' '),model:state.model.name,palette:state.palette.id});
            frame.src='/preview/'+columns+'/'+rows+'?'+params;
            fitCard(card,size.width,size.height);
          }
        };
        form.addEventListener('trmnl:change',()=>refresh());
        for(const el of [colorMode,fontFamily,textScale,gridColumns,gridRows]) el.addEventListener('change',refresh);
        window.addEventListener('resize',refresh);
        picker=await TRMNLPicker.create(form,{localStorageKey:'odstudio-picker'});
        if(!localStorage.getItem('odstudio-preview-seeded')){
          picker.setParams({modelName:cfg.defaultModel,paletteId:cfg.defaultPalette,isPortrait:false,isDarkMode:false});
          localStorage.setItem('odstudio-preview-seeded','1');
        }
        refresh();
        const es=new EventSource('/events');let first=true;es.addEventListener('ready',()=>{if(first){first=false;return;}location.reload()});es.addEventListener('reload',()=>location.reload());
      </script></body></html>`);
    } catch (error) {
      res.status(500).type("html").send(`<pre class="error">${escapeHtml(error instanceof Error ? error.stack ?? error.message : error)}</pre>`);
    }
  });

  app.get("/preview/:columns/:rows", async (req, res) => {
    try {
      const project = await loadProject(projectRoot);
      const columns = intParam(req.params.columns, 1, 1, 12);
      const rows = intParam(req.params.rows, 1, 1, 12);
      const viewportWidth = intParam(req.query.dw, project.preview.display.width ?? 800);
      const viewportHeight = intParam(req.query.dh, project.preview.display.height ?? 480);
      const gridColumns = intParam(req.query.gc, project.preview.display.columns, 1, 12);
      const gridRows = intParam(req.query.gr, project.preview.display.rows, 1, 12);
      const activePreview = {
        ...project.preview,
        display: { ...project.preview.display, columns: gridColumns, rows: gridRows },
      };
      const size = regionSizeForViewport(activePreview, viewportWidth, viewportHeight, columns, rows);
      const screenClasses = safeClasses(req.query.screen_classes);
      const viewport = {
        width: viewportWidth,
        height: viewportHeight,
        model: String(req.query.model ?? project.preview.display.model),
        palette: String(req.query.palette ?? project.preview.display.palette),
        screenClasses,
      };
      const fragment = await renderWidget(project.template, project.widget, activePreview, project.fixture, columns, rows, viewport);
      const version = encodeURIComponent(project.widget.framework);
      const classes = Array.from(new Set(["screen", ...screenClasses])).join(" ");
      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${size.width},initial-scale=1">
      <link rel="stylesheet" href="https://trmnl.com/css/${version}/plugins.css">
      <style>html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff}.screen.od-region-screen{--screen-w:${size.width}px!important;--screen-h:${size.height}px!important;--pixel-ratio:1!important;width:${size.width}px!important;height:${size.height}px!important;padding:0!important;margin:0!important;transform:none!important;overflow:hidden!important}.od-region{width:100%;height:100%;overflow:hidden;container-type:size}.od-region>.item{width:100%!important;height:100%!important;margin:0!important}</style></head>
      <body><section class="${escapeHtml(classes)} od-region-screen"><div class="od-region">${fragment}</div></section>
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
