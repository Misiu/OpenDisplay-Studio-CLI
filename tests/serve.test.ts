import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { serveProject } from "../src/serve.js";

const temporaryProjects: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), "odstudio-serve-"));
  temporaryProjects.push(root);
  await mkdir(join(root, "fixtures"));
  await Promise.all([
    writeFile(
      join(root, "widget.yml"),
      "id: test\nname: Test\nframework: 3.2.0\ntemplate: widget.liquid\n",
    ),
    writeFile(
      join(root, "preview.yml"),
      "display:\n  model: custom\n  palette: bw\n  columns: 4\n  rows: 2\nfixture: default.yml\nspans:\n  - { columns: 4, rows: 2 }\n  - { columns: 2, rows: 1 }\n",
    ),
    writeFile(join(root, "widget.liquid"), "<div>{{ region.width }}x{{ region.height }}</div>\n"),
    writeFile(join(root, "fixtures", "default.yml"), "data: {}\n"),
  ]);
  return root;
}

describe("preview viewport", () => {
  it("renders full and partial previews at their calculated box dimensions", async () => {
    const root = await createProject();
    const preview = await serveProject(root, 0, false);
    await new Promise<void>((resolve) => {
      if (preview.server.listening) resolve();
      else preview.server.once("listening", resolve);
    });

    try {
      const address = preview.server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
      const base = `http://127.0.0.1:${address.port}`;
      const query = "dw=800&dh=480&gc=4&gr=2&screen_classes=screen%20screen--md%20screen--1x";

      const partial = await (await fetch(`${base}/preview/2/1?${query}`)).text();
      expect(partial).toContain("width:388px!important;height:228px!important");
      expect(partial).toContain('class="screen screen--md screen--1x od-region-screen"');
      expect(partial).not.toContain("od-device-canvas");

      const full = await (
        await fetch(
          `${base}/preview/4/2?dw=200&dh=200&gc=4&gr=2&screen_classes=screen%20screen--sm%20screen--1x`,
        )
      ).text();
      expect(full).toContain("--screen-w:200px!important;--screen-h:200px!important");
      expect(full).toContain('class="screen screen--sm screen--1x od-full-screen"');
    } finally {
      await preview.close();
    }
  });

  it("watches fixture files for live reloads", async () => {
    const root = await createProject();
    const preview = await serveProject(root, 0, false);

    try {
      await new Promise<void>((resolve) => preview.watcher.once("ready", resolve));
      const changed = new Promise<{ event: string; path: string }>((resolve) => {
        preview.watcher.once("all", (event, path) => resolve({ event, path }));
      });

      await writeFile(join(root, "fixtures", "default.yml"), "data:\n  changed: true\n");
      const result = await changed;
      expect(result.event).toBe("change");
      expect(result.path.replaceAll("\\", "/")).toBe("fixtures/default.yml");
    } finally {
      await preview.close();
    }
  });
});
