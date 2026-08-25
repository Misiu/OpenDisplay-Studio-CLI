import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listFixtures, loadProject } from "../src/project.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), "odstudio-fixtures-"));
  roots.push(root);
  await mkdir(join(root, "fixtures"));
  await writeFile(join(root, "widget.yml"), "id: demo\nname: Demo\ntemplate: widget.liquid\n", "utf8");
  await writeFile(
    join(root, "preview.yml"),
    "display:\n  model: waveshare_7_5_bw\n  palette: bw\n  columns: 1\n  rows: 1\nfixture: default.yml\nspans:\n  - { columns: 1, rows: 1 }\n",
    "utf8",
  );
  await writeFile(join(root, "widget.liquid"), "{{ data.state }}", "utf8");
  await writeFile(join(root, "fixtures", "default.yml"), "data:\n  state: closed\n", "utf8");
  await writeFile(join(root, "fixtures", "unlocked.yml"), "data:\n  state: unlocked\n", "utf8");
  await writeFile(join(root, "fixtures", "ignored.txt"), "ignored", "utf8");
  return root;
}

describe("fixtures", () => {
  it("discovers supported fixture files", async () => {
    const root = await createProject();
    expect(await listFixtures(root)).toEqual(["default.yml", "unlocked.yml"]);
  });

  it("loads a selected fixture without changing preview.yml", async () => {
    const root = await createProject();
    const project = await loadProject(root, "unlocked.yml");
    expect(project.fixtureName).toBe("unlocked.yml");
    expect(project.fixture).toEqual({ data: { state: "unlocked" } });
  });

  it("rejects fixture paths outside the fixtures directory", async () => {
    const root = await createProject();
    await expect(loadProject(root, "../widget.yml")).rejects.toThrow(/Fixture not found/);
  });
});
