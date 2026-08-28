import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { publishProject } from "../src/publish.js";

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "odstudio-publish-"));
  await mkdir(join(root, "fixtures"));
  await mkdir(join(root, "translations"));
  await mkdir(join(root, "assets", "icons"), { recursive: true });
  await writeFile(join(root, "widget.yml"), `
id: demo
name: Demo
version: "0.5.0"
icon: mdi:test-tube
framework: 3.2.0
template: widget.liquid
provider: provider.py
`);
  await writeFile(join(root, "preview.yml"), "display:\n  model: waveshare_7_5_bw\n  palette: bw\n  columns: 1\n  rows: 1\nfixture: default.yml\nspans:\n  - columns: 1\n    rows: 1\n");
  await writeFile(
    join(root, "widget.liquid"),
    "<div><img src=\"{{ assets['icons/value.svg'] }}\">{{ data.value }}</div>",
  );
  await writeFile(join(root, "provider.py"), "PROVIDER = object()\n");
  await writeFile(join(root, "translations", "en.json"), '{"value":"Value"}\n');
  await writeFile(join(root, "assets", "icons", "value.svg"), "<svg></svg>\n");
  await writeFile(join(root, "fixtures", "default.yml"), "data:\n  value: ready\n");
  return root;
}

describe("publish", () => {
  it("packages the complete self-contained widget without development fixtures", async () => {
    const root = await createProject();

    const result = await publishProject(root);
    const archive = unzipSync(new Uint8Array(await readFile(result.zipPath)));

    expect(Object.keys(archive).sort()).toEqual([
      "PACKAGE_INFO.txt",
      "assets/icons/value.svg",
      "provider.py",
      "translations/en.json",
      "widget.liquid",
      "widget.yml",
    ]);
    expect(await readFile(join(result.packageDir, "translations", "en.json"), "utf8"))
      .toContain("Value");
  });

  it("rejects manifest paths outside the widget package", async () => {
    const root = await createProject();
    await writeFile(join(root, "widget.yml"), `
id: demo
name: Demo
version: "0.5.0"
template: ../outside.liquid
`);

    await expect(publishProject(root)).rejects.toThrow("template must name a file");
  });
});
