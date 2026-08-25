import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const widgetYaml = (id: string, name: string) => `id: ${id}
name: ${name}
version: 1
description: Example OpenDisplay Studio widget
framework: 3.2.0
template: widget.liquid

defaults:
  title: Hello OpenDisplay

fields:
  - key: title
    label: Title
    type: text

dataRequirements: []
`;

const previewYaml = `display:
  name: 7.5 inch 800x480
  width: 800
  height: 480
  columns: 4
  rows: 2

fixture: default.yml

spans:
  - { columns: 4, rows: 2 }
  - { columns: 2, rows: 2 }
  - { columns: 4, rows: 1 }
  - { columns: 2, rows: 1 }
  - { columns: 1, rows: 2 }
  - { columns: 1, rows: 1 }
`;

const template = `<div class="item">
  <div class="content layout layout--col gap--small">
    <span class="title">{{ config.title }}</span>
    <span class="description">{{ data.message }}</span>
    <span class="label">{{ region.width }} × {{ region.height }} px</span>
  </div>
</div>
`;

const fixture = `data:
  message: Edit widget.liquid and save to refresh every preview.
`;

export async function initProject(name: string, cwd = process.cwd()) {
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) throw new Error("Widget name must contain letters or numbers.");
  const target = resolve(cwd, id);
  try {
    await access(target);
    throw new Error(`Target already exists: ${target}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("Target already exists")) throw error;
  }

  await mkdir(join(target, "fixtures"), { recursive: true });
  await writeFile(join(target, "widget.yml"), widgetYaml(id, name), "utf8");
  await writeFile(join(target, "preview.yml"), previewYaml, "utf8");
  await writeFile(join(target, "widget.liquid"), template, "utf8");
  await writeFile(join(target, "fixtures", "default.yml"), fixture, "utf8");
  return target;
}
