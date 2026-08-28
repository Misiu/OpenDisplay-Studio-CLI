import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { loadAssetDataUris } from "./assets.js";

const spanSchema = z.object({ columns: z.number().int().positive(), rows: z.number().int().positive() });
const fixtureFilePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(ya?ml|json)$/i;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const widgetVersionSchema = z.string().regex(semanticVersionPattern);
const networkOriginSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol)
      && url.origin === value.replace(/\/$/, "")
      && url.username === ""
      && url.password === ""
      && ["", "/"].includes(url.pathname)
      && url.search === ""
      && url.hash === ""
    );
  } catch {
    return false;
  }
}, "Network permission must be an HTTP(S) origin without a path")
  .transform((value) => new URL(value).origin);

export const widgetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: widgetVersionSchema.default("0.6.0"),
  description: z.string().default(""),
  icon: z.string().default("mdi:puzzle-outline"),
  framework: z.string().default("3.2.0"),
  template: z.string().default("widget.liquid"),
  provider: z.string().optional(),
  defaults: z.record(z.string(), z.unknown()).default({}),
  fields: z.array(z.record(z.string(), z.unknown())).default([]),
  dataRequirements: z.array(z.record(z.string(), z.unknown())).default([]),
  permissions: z.object({
    network: z.object({
      allowedOrigins: z.array(networkOriginSchema).max(16).default([]),
    }).default({ allowedOrigins: [] }),
  }).default({ network: { allowedOrigins: [] } }),
});

export const previewSchema = z.object({
  display: z.object({
    model: z.string().default("waveshare_7_5_bw"),
    palette: z.string().default("bw"),
    columns: z.number().int().positive().default(4),
    rows: z.number().int().positive().default(2),
    gap: z.number().int().nonnegative().optional(),
    name: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
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

function rootFile(value: string, field: string): string {
  if (!value || basename(value) !== value) {
    throw new Error(`${field} must name a file in the widget root`);
  }
  return value;
}

export interface PreviewViewport {
  width: number;
  height: number;
  model?: string;
  palette?: string;
  screenClasses?: string[];
}

export async function listFixtures(root: string) {
  const entries = await readdir(join(root, "fixtures"), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && fixtureFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function loadProject(root: string, fixtureOverride?: string) {
  const widget = widgetSchema.parse(YAML.parse(await readFile(join(root, "widget.yml"), "utf8")));
  const templateFile = rootFile(widget.template, "template");
  const preview = previewSchema.parse(YAML.parse(await readFile(join(root, "preview.yml"), "utf8")));
  const template = await readFile(join(root, templateFile), "utf8");
  const fixtures = await listFixtures(root);
  const fixtureName = fixtureOverride ?? preview.fixture;

  if (!fixtureFilePattern.test(fixtureName) || !fixtures.includes(fixtureName)) {
    throw new Error(`Fixture not found: ${fixtureName}`);
  }

  const [fixtureContent, assets] = await Promise.all([
    readFile(join(root, "fixtures", fixtureName), "utf8"),
    loadAssetDataUris(root),
  ]);
  const fixture = YAML.parse(fixtureContent) ?? {};
  return { widget, preview, template, fixture, fixtureName, fixtures, assets };
}

export function defaultViewport(preview: PreviewConfig): PreviewViewport {
  return {
    width: preview.display.width ?? 800,
    height: preview.display.height ?? 480,
    model: preview.display.model,
    palette: preview.display.palette,
  };
}

export function regionSizeForViewport(
  preview: PreviewConfig,
  viewportWidth: number,
  viewportHeight: number,
  columns: number,
  rows: number,
) {
  const d = preview.display;
  if (columns > d.columns || rows > d.rows) {
    throw new Error(`Span ${columns}x${rows} exceeds ${d.columns}x${d.rows} grid`);
  }

  if (columns === d.columns && rows === d.rows) {
    return { width: viewportWidth, height: viewportHeight, gap: 0 };
  }

  const gap = d.gap ?? Math.max(3, Math.min(10, Math.round(Math.min(viewportWidth, viewportHeight) / 60)));
  const cellWidth = (viewportWidth - gap * (d.columns + 1)) / d.columns;
  const cellHeight = (viewportHeight - gap * (d.rows + 1)) / d.rows;
  return {
    width: Math.round(cellWidth * columns + gap * (columns - 1)),
    height: Math.round(cellHeight * rows + gap * (rows - 1)),
    gap,
  };
}

export function regionSize(preview: PreviewConfig, columns: number, rows: number) {
  const viewport = defaultViewport(preview);
  return regionSizeForViewport(preview, viewport.width, viewport.height, columns, rows);
}
