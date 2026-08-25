import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";

const spanSchema = z.object({ columns: z.number().int().positive(), rows: z.number().int().positive() });

export const widgetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive().default(1),
  description: z.string().default(""),
  framework: z.string().default("3.2.0"),
  template: z.string().default("widget.liquid"),
  defaults: z.record(z.string(), z.unknown()).default({}),
  fields: z.array(z.record(z.string(), z.unknown())).default([]),
  dataRequirements: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const previewSchema = z.object({
  display: z.object({
    name: z.string().default("7.5 inch 800x480"),
    width: z.number().int().positive().default(800),
    height: z.number().int().positive().default(480),
    columns: z.number().int().positive().default(4),
    rows: z.number().int().positive().default(2),
    gap: z.number().int().nonnegative().optional(),
  }),
  fixture: z.string().default("default.yml"),
  spans: z.array(spanSchema).default([
    { columns: 4, rows: 2 },
    { columns: 2, rows: 2 },
    { columns: 4, rows: 1 },
    { columns: 2, rows: 1 },
    { columns: 1, rows: 2 },
    { columns: 1, rows: 1 },
  ]),
});

export type WidgetManifest = z.infer<typeof widgetSchema>;
export type PreviewConfig = z.infer<typeof previewSchema>;

export async function loadProject(root: string) {
  const widget = widgetSchema.parse(YAML.parse(await readFile(join(root, "widget.yml"), "utf8")));
  const preview = previewSchema.parse(YAML.parse(await readFile(join(root, "preview.yml"), "utf8")));
  const template = await readFile(join(root, widget.template), "utf8");
  const fixture = YAML.parse(await readFile(join(root, "fixtures", preview.fixture), "utf8")) ?? {};
  return { widget, preview, template, fixture };
}

export function regionSize(preview: PreviewConfig, columns: number, rows: number) {
  const d = preview.display;
  if (columns > d.columns || rows > d.rows) throw new Error(`Span ${columns}x${rows} exceeds ${d.columns}x${d.rows} grid`);
  const gap = d.gap ?? Math.max(3, Math.min(10, Math.round(Math.min(d.width, d.height) / 60)));
  const cellWidth = (d.width - gap * (d.columns + 1)) / d.columns;
  const cellHeight = (d.height - gap * (d.rows + 1)) / d.rows;
  return {
    width: Math.round(cellWidth * columns + gap * (columns - 1)),
    height: Math.round(cellHeight * rows + gap * (rows - 1)),
    gap,
  };
}
