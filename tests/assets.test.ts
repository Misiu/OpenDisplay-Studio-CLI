import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAssetDataUris, validateRemoteAssetReferences } from "../src/assets.js";

describe("widget assets", () => {
  it("encodes nested supported files as data URIs", async () => {
    const root = await mkdtemp(join(tmpdir(), "odstudio-assets-"));
    await mkdir(join(root, "assets", "icons"), { recursive: true });
    await writeFile(join(root, "assets", "icons", "weather.svg"), "<svg></svg>");

    const assets = await loadAssetDataUris(root);

    expect(assets["icons/weather.svg"]).toBe(
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    );
  });

  it("rejects unsupported and oversized files", async () => {
    const unsupported = await mkdtemp(join(tmpdir(), "odstudio-assets-"));
    await mkdir(join(unsupported, "assets"));
    await writeFile(join(unsupported, "assets", "provider.py"), "unsafe");
    await expect(loadAssetDataUris(unsupported)).rejects.toThrow("Unsupported widget asset type");

    const oversized = await mkdtemp(join(tmpdir(), "odstudio-assets-"));
    await mkdir(join(oversized, "assets"));
    await writeFile(join(oversized, "assets", "large.png"), Buffer.alloc(512_001));
    await expect(loadAssetDataUris(oversized)).rejects.toThrow("exceeds 512000 bytes");

    const excessiveTotal = await mkdtemp(join(tmpdir(), "odstudio-assets-"));
    await mkdir(join(excessiveTotal, "assets"));
    await writeFile(join(excessiveTotal, "assets", "first.png"), Buffer.alloc(300_000));
    await writeFile(join(excessiveTotal, "assets", "second.png"), Buffer.alloc(300_000));
    await expect(loadAssetDataUris(excessiveTotal)).rejects.toThrow(
      "Widget assets exceed 512000 bytes",
    );
  });

  it("requires remote asset origins to be declared", () => {
    const image = '<img src="https://cdn.example.com/a.svg">';
    expect(() => validateRemoteAssetReferences(image, []))
      .toThrow("origin is not declared");
    expect(() => validateRemoteAssetReferences(image, ["https://cdn.example.com"]))
      .not.toThrow();
    expect(() => validateRemoteAssetReferences(
      "<style>.x{background:url(http://example.com/a.png)}</style>",
      [],
    )).toThrow("origin is not declared");
    expect(() => validateRemoteAssetReferences(
      '<style>@import "https://cdn.example.com/theme.css";</style>',
      ["https://cdn.example.com"],
    )).not.toThrow();
    expect(() => validateRemoteAssetReferences(
      "<p>https://example.com is documentation</p>",
      [],
    ))
      .not.toThrow();
  });
});
