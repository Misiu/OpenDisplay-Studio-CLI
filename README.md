# OpenDisplay Studio CLI

Local development tooling for OpenDisplay Studio widgets.

The intended workflow is similar to Wrangler/Vite: create a widget project, open it in VS Code, edit one Liquid template, see it refresh live on several region sizes and real device profiles, then build a distributable package.

> **Status:** early POC. The CLI and package format are intentionally small while they become the shared contract for OpenDisplay Studio Integration and the future widget catalog.

## Requirements

- Node.js 20 or newer
- npm
- a modern browser

```bash
node --version
npm --version
```

## Install the current POC

The POC is developed on `main` and is not published to npm yet.

Widget templates are validated with the pinned LiquidJS engine from
`package.json`; the integration runs the same templates through a cross-engine
conformance suite before release.

```bash
git clone https://github.com/Misiu/OpenDisplay-Studio-CLI.git
cd OpenDisplay-Studio-CLI
npm install
npm run build
npm link
```

Verify:

```bash
odstudio --version
odstudio --help
```

After pulling newer changes:

```bash
git pull
npm install
npm run build
```

`npm link` normally does not need to be repeated.

To remove the global link:

```bash
npm unlink -g opendisplay-studio-cli
```

## Quick start

Create widgets outside the CLI repository:

```bash
cd C:\Projects
odstudio init my-widget
cd my-widget
code .
odstudio serve
```

The browser opens at:

```text
http://127.0.0.1:7341
```

Edit and save any of:

```text
widget.liquid
widget.yml
preview.yml
fixtures/*.yml
```

The workbench reloads automatically.

When finished:

```bash
odstudio publish
```

## Commands

### `odstudio init <name>`

Creates:

```text
my-widget/
  widget.yml
  widget.liquid
  preview.yml
  fixtures/
    default.yml
```

`widget.yml` and `widget.liquid` are runtime files. `preview.yml` and `fixtures/` are development-only.

### `odstudio serve`

Starts the live workbench.

```bash
odstudio serve
odstudio serve --port 8080
odstudio serve --no-open
```

The workbench has two independent concepts:

1. **Device profile** - selected with the official TRMNL Picker. It supplies the real device viewport, supported palettes, orientation, dark mode and Framework screen classes.
2. **OpenDisplay grid** - configured as columns × rows. Widget spans are calculated inside that grid on the currently selected device.

This distinction is important. A `2x1` widget is not a fixed pixel size. It can be roughly half of an 800x480 display, half of a 10-inch display, or half of a small 4-inch display. Its actual region dimensions are recalculated whenever the device or orientation changes.

The current workbench lets you change:

- Device
- Palette
- Light/Dark mode
- Landscape/Portrait
- Raw/Preview color mode
- Default/Classic/TRMNL font family
- Text scale
- OpenDisplay grid columns and rows

Every configured span is shown simultaneously. Each preview iframe renders at its **real region pixel size**, then the workbench scales the iframe visually so the entire region fits in its card. The preview itself is never resized to a fake viewport.

### `odstudio publish`

Validates Liquid and creates:

```text
dist/
  my-widget/
    widget.yml
    widget.liquid
  my-widget-1.zip
```

Development-only files are excluded.

## `widget.yml`

Runtime manifest consumed by OpenDisplay Studio.

```yaml
id: my-widget
name: My Widget
version: "0.5.0"
framework: 3.2.0
template: widget.liquid

defaults:
  title: Hello OpenDisplay

fields:
  - key: title
    label: Title
    type: text

dataRequirements: []
```

The Framework version is pinned deliberately. A widget should not silently render against a newer Framework after it has been published.

## `preview.yml`

Local workbench configuration.

```yaml
display:
  # Defaults for the workbench. Device dimensions come from TRMNL Picker.
  model: waveshare_7_5_bw
  palette: bw

  # OpenDisplay grid for this development scenario.
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
```

Do **not** duplicate known device dimensions in this file. The selected TRMNL device profile is the source of truth for physical rendering properties.

Changing the grid in the browser is a preview override. Changing `preview.yml` changes the project's defaults.

## Device-aware rendering

The workbench uses the same `@trmnl/picker` package used by TRMNL's own local `trmnlp` developer server.

The picker supplies device-specific `screenClasses`. These carry more information than width and height, including device density, UI scale, palette/bit-depth behavior and dark/orientation state.

For a widget region, OpenDisplay keeps those device rendering characteristics but overrides the Framework screen width/height with the **actual region viewport**. This prevents a `1x1` widget on an 800x480 screen from incorrectly laying itself out as if it still had the whole 800x480 canvas.

The grid geometry follows the same model as OpenDisplay Studio:

```text
cell width  = (device width  - gap * (columns + 1)) / columns
cell height = (device height - gap * (rows + 1)) / rows
```

A span then combines the relevant cells plus internal gaps.

## Liquid context

The POC uses LiquidJS 10.21.x, the same Liquid engine family used by TRMNL's Node BYOS project.

Templates receive:

```text
config.*
data.*

region.width
region.height
region.columns
region.rows
region.columnSpan
region.rowSpan
region.aspectRatio
region.shape

display.width
display.height
display.model
display.palette
display.screenClasses
```

Example:

```liquid
{% if region.width < 250 %}
  <span class="label">Compact</span>
{% else %}
  <span class="title">{{ config.title }}</span>
{% endif %}
```

Use CSS container queries for purely visual adaptation when possible. Each widget region is a CSS container.

## TRMNL Framework

The POC currently loads the exact Framework version pinned by the widget:

```text
https://trmnl.com/css/3.2.0/plugins.min.css
https://trmnl.com/js/3.2.0/plugins.min.js
```

The preview uses the same production/minified Framework artifact variant as the
Renderer App. The physical device dimensions remain in `--screen-w` and
`--screen-h`; an independent size container controls responsive widget layout.
A follow-up will cache the official Framework release ZIP and font bundles
locally so development works offline after the first download.

## Developing the CLI

```bash
npm run dev -- --help
npm run check
npm run build
npm test
```

## Current limitations

- Framework/font release assets are not cached locally yet.
- Theme selection is not exposed yet; it will be populated from the pinned Framework release rather than hardcoded.
- Fixture files can be switched from the preview toolbar.
- Missing image assets fail visibly; general overflow diagnostics are not implemented yet.
- PNG snapshot rendering is not implemented yet.
- The CLI does not connect to Home Assistant; fixtures provide normalized development data.
- Full `trmnl-liquid` custom filter/tag compatibility is being implemented separately.

## Architecture

```text
widget project
    -> Liquid + fixture data
    -> TRMNL device profile + OpenDisplay grid
    -> live multi-size workbench
    -> validation
    -> distributable widget package
```

The CLI does not own Home Assistant providers. OpenDisplay Studio Integration supplies real entity/calendar/etc. data at runtime using the same normalized contract represented by fixtures.

Pixel-exact PNG validation should eventually call the same OpenDisplay Studio Renderer used by the Integration rather than introducing a second production renderer inside the CLI.
