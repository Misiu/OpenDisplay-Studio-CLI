import { Liquid } from "liquidjs";
import type { PreviewConfig, WidgetManifest } from "./project.js";
import { regionSize } from "./project.js";

const engine = new Liquid({
  dynamicPartials: true,
  strictFilters: true,
  strictVariables: true,
});

export async function renderWidget(
  template: string,
  widget: WidgetManifest,
  preview: PreviewConfig,
  fixture: Record<string, unknown>,
  columns: number,
  rows: number,
) {
  const size = regionSize(preview, columns, rows);
  const ratio = size.width / Math.max(1, size.height);
  const shape = ratio >= 1.55 ? "wide" : ratio <= 0.72 ? "tall" : "square";

  return engine.parseAndRender(template, {
    config: widget.defaults,
    data: fixture.data ?? fixture,
    region: {
      width: size.width,
      height: size.height,
      columns,
      rows,
      columnSpan: columns,
      rowSpan: rows,
      aspectRatio: ratio,
      shape,
    },
    display: preview.display,
  });
}
