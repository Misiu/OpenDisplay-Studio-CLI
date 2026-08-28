import { readFile, readdir } from "node:fs/promises";
import { extname, join, sep } from "node:path";

export const MAX_WIDGET_ASSET_BYTES = 512_000;
export const MAX_WIDGET_ASSETS_BYTES = 512_000;

const mimeTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const remoteAssetPatterns = [
  /\b(?:src|srcset)\s*=\s*["']([^"']*https?:\/\/[^"']+)["']/giu,
  /\burl\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/giu,
  /<link\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/giu,
  /@import\s+(?:url\(\s*)?["']?(https?:\/\/[^"')\s;]+)["']?\s*\)?/giu,
  /<(?:image|use)\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/giu,
  /<object\b[^>]*\bdata\s*=\s*["'](https?:\/\/[^"']+)["']/giu,
];
const remoteUrlPattern = /https?:\/\/[^\s,"']+/giu;

export function validateRemoteAssetReferences(
  html: string,
  allowedOrigins: string[],
): void {
  const allowed = new Set(allowedOrigins);
  for (const pattern of remoteAssetPatterns) {
    for (const match of html.matchAll(pattern)) {
      for (const value of match[1].matchAll(remoteUrlPattern)) {
        const url = new URL(value[0]);
        if (!allowed.has(url.origin)) {
          throw new Error(
            `Remote widget asset origin is not declared in permissions: ${url.origin}`,
          );
        }
      }
    }
  }
}

async function collect(root: string, relativeDirectory = ""): Promise<string[]> {
  const absolute = join(root, "assets", relativeDirectory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(relativeDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Widget assets cannot contain symbolic links: ${child}`);
    if (entry.isDirectory()) files.push(...await collect(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`Unsupported widget asset entry: ${child}`);
  }
  return files;
}

export async function loadAssetDataUris(root: string): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  let totalBytes = 0;
  for (const relativePath of await collect(root)) {
    const mimeType = mimeTypes[extname(relativePath).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported widget asset type: ${relativePath}`);
    const content = await readFile(join(root, "assets", relativePath));
    if (content.byteLength > MAX_WIDGET_ASSET_BYTES) {
      throw new Error(`Widget asset exceeds ${MAX_WIDGET_ASSET_BYTES} bytes: ${relativePath}`);
    }
    totalBytes += content.byteLength;
    if (totalBytes > MAX_WIDGET_ASSETS_BYTES) {
      throw new Error(`Widget assets exceed ${MAX_WIDGET_ASSETS_BYTES} bytes`);
    }
    const key = relativePath.split(sep).join("/");
    assets[key] = `data:${mimeType};base64,${content.toString("base64")}`;
  }
  return assets;
}
