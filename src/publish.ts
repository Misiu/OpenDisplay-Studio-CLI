import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { strToU8, zipSync } from "fflate";
import { validateRemoteAssetReferences } from "./assets.js";
import { renderWidget } from "./liquid.js";
import { loadProject } from "./project.js";

const packageDirectories = ["translations", "assets"];

function packageFile(value: string, field: string): string {
  if (!value || basename(value) !== value) {
    throw new Error(`${field} must name a file in the widget root`);
  }
  return value;
}

async function collectDirectoryFiles(root: string, directory: string): Promise<string[]> {
  const absolute = join(root, directory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectDirectoryFiles(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`Unsupported package entry: ${child}`);
  }
  return files;
}

const archivePath = (file: string): string => file.split(sep).join("/");

export async function publishProject(root = process.cwd()) {
  const projectRoot = resolve(root);
  const project = await loadProject(projectRoot);

  for (const span of project.preview.spans) {
    const html = await renderWidget(
      project.template,
      project.widget,
      project.preview,
      project.fixture,
      span.columns,
      span.rows,
      undefined,
      project.assets,
    );
    validateRemoteAssetReferences(
      html,
      project.widget.permissions.network.allowedOrigins,
    );
  }

  const outRoot = join(projectRoot, "dist");
  const packageDir = join(outRoot, project.widget.id);
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  const files = [
    "widget.yml",
    packageFile(project.widget.template, "template"),
    ...(project.widget.provider ? [packageFile(project.widget.provider, "provider")] : []),
  ];
  for (const directory of packageDirectories) {
    files.push(...await collectDirectoryFiles(projectRoot, directory));
  }

  const zipEntries: Record<string, Uint8Array> = {};
  for (const file of [...new Set(files)]) {
    const source = join(projectRoot, file);
    const destination = join(packageDir, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
    zipEntries[archivePath(relative(projectRoot, source))] = new Uint8Array(await readFile(source));
  }
  zipEntries["PACKAGE_INFO.txt"] = strToU8(`OpenDisplay Studio widget\nID: ${project.widget.id}\nVersion: ${project.widget.version}\nFramework: ${project.widget.framework}\n`);

  const zip = zipSync(zipEntries, { level: 9 });
  const zipPath = join(outRoot, `${project.widget.id}-${project.widget.version}.zip`);
  await writeFile(zipPath, zip);
  return { packageDir, zipPath };
}
