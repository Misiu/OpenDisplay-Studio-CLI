import { describe, expect, it } from "vitest";
import { previewSchema, regionSize, widgetSchema } from "../src/project.js";

describe("widget version", () => {
  it("accepts semver and rejects numeric versions", () => {
    expect(widgetSchema.parse({ id: "demo", name: "Demo", version: "0.5.0" }).version)
      .toBe("0.5.0");
    expect(() => widgetSchema.parse({ id: "demo", name: "Demo", version: 4 }))
      .toThrow();
  });
});

describe("widget network permissions", () => {
  it("accepts explicit origins and defaults to local-only", () => {
    expect(widgetSchema.parse({ id: "demo", name: "Demo" }).permissions)
      .toEqual({ network: { allowedOrigins: [] } });
    expect(widgetSchema.parse({
      id: "remote",
      name: "Remote",
      permissions: { network: { allowedOrigins: ["https://cdn.example.com/"] } },
    }).permissions.network.allowedOrigins).toEqual(["https://cdn.example.com"]);
  });

  it("rejects paths, credentials, and non-HTTP protocols", () => {
    for (const origin of [
      "https://example.com/path",
      "https://user:pass@example.com",
      "file:///tmp/assets",
    ]) {
      expect(() => widgetSchema.parse({
        id: "invalid",
        name: "Invalid",
        permissions: { network: { allowedOrigins: [origin] } },
      })).toThrow();
    }
  });
});

describe("regionSize", () => {
  const preview = previewSchema.parse({
    display: { name: "7.5", width: 800, height: 480, columns: 4, rows: 2, gap: 8 },
  });

  it("uses the full device viewport for a full-grid span", () => {
    expect(regionSize(preview, 4, 2)).toEqual({ width: 800, height: 480, gap: 0 });
  });

  it("keeps configured dashboard gutters for partial spans", () => {
    expect(regionSize(preview, 2, 1)).toEqual({ width: 388, height: 228, gap: 8 });
    expect(regionSize(preview, 1, 1)).toEqual({ width: 190, height: 228, gap: 8 });
  });

  it("rejects spans outside the configured grid", () => {
    expect(() => regionSize(preview, 5, 1)).toThrow(/exceeds/);
  });
});
