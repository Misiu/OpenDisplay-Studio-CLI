import { describe, expect, it } from "vitest";
import { renderWidget } from "../src/liquid.js";
import { previewSchema, widgetSchema } from "../src/project.js";

describe("TRMNL lax Liquid contract", () => {
  const widget = widgetSchema.parse({
    id: "weather-contract",
    name: "Weather contract",
  });
  const preview = previewSchema.parse({
    display: { columns: 1, rows: 1, width: 800, height: 480 },
  });

  it("renders an absent nested property as an empty value", async () => {
    const template = `
      {% assign current = data.weather %}
      {% assign forecast = current.forecast %}
      {% if forecast != nil and forecast != empty %}forecast{% else %}current only{% endif %}
    `;

    const html = await renderWidget(
      template,
      widget,
      preview,
      { data: { weather: { temperature: 12 } } },
      1,
      1,
    );

    expect(html).toContain("current only");
  });
});
