import { describe, expect, it } from "vitest";
import { previewSchema, regionSize } from "../src/project.js";

describe("regionSize", () => {
  const preview = previewSchema.parse({
    display: { name: "7.5", width: 800, height: 480, columns: 4, rows: 2, gap: 8 },
  });

  it("matches Studio grid geometry", () => {
    expect(regionSize(preview, 4, 2)).toEqual({ width: 784, height: 464, gap: 8 });
    expect(regionSize(preview, 2, 1)).toEqual({ width: 388, height: 228, gap: 8 });
    expect(regionSize(preview, 1, 1)).toEqual({ width: 190, height: 228, gap: 8 });
  });

  it("rejects spans outside the configured grid", () => {
    expect(() => regionSize(preview, 5, 1)).toThrow(/exceeds/);
  });
});
