import { Liquid } from "liquidjs";
import type { PreviewConfig, PreviewViewport, WidgetManifest } from "./project.js";
import { defaultViewport, regionSizeForViewport } from "./project.js";

const engine = new Liquid({
  dynamicPartials: true,
  strictFilters: false,
  strictVariables: false,
});

export async function renderWidget(
  template: string,
  widget: WidgetManifest,
  preview: PreviewConfig,
  fixture: Record<string, unknown>,
  columns: number,
  rows: number,
  viewport: PreviewViewport = defaultViewport(preview),
  assets: Record<string, string> = {},
) {
  const size = regionSizeForViewport(preview, viewport.width, viewport.height, columns, rows);
  const ratio = size.width / Math.max(1, size.height);
  const shape = ratio >= 1.55 ? "wide" : ratio <= 0.72 ? "tall" : "square";

  return engine.parseAndRender(template, {
    config: widget.defaults,
    data: fixture.data ?? fixture,
    assets,
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
    display: {
      ...preview.display,
      width: viewport.width,
      height: viewport.height,
      model: viewport.model ?? preview.display.model,
      palette: viewport.palette ?? preview.display.palette,
      screenClasses: viewport.screenClasses ?? [],
    },
  });
}
