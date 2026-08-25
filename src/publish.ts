import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { loadProject } from "./project.js";
import { renderWidget } from "./liquid.js";

export async function publishProject(root = process.cwd()) {
  const projectRoot = resolve(root);
  const project = await loadProject(projectRoot);

  for (const span of project.preview.spans) {
    await renderWidget(project.template, project.widget, project.preview, project.fixture, span.columns, span.rows);
  }

  const outRoot = join(projectRoot, "dist");
  const packageDir = join(outRoot, project.widget.id);
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  const files = ["widget.yml", project.widget.template];
  for (const file of files) await cp(join(projectRoot, file), join(packageDir, basename(file)));

  const zipEntries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(join(projectRoot, file)));
    zipEntries[basename(file)] = new Uint8Array(bytes);
  }
  zipEntries["PACKAGE_INFO.txt"] = strToU8(`OpenDisplay Studio widget\nID: ${project.widget.id}\nVersion: ${project.widget.version}\nFramework: ${project.widget.framework}\n`);

  const zip = zipSync(zipEntries, { level: 9 });
  const zipPath = join(outRoot, `${project.widget.id}-${project.widget.version}.zip`);
  await writeFile(zipPath, zip);
  return { packageDir, zipPath };
}
