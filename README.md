# OpenDisplay Studio CLI

Local development tooling for OpenDisplay Studio widgets.

The goal is a workflow similar to modern developer CLIs such as Wrangler: initialize a widget, edit it in VS Code, see all configured grid spans refresh live, then publish a distributable package.

## Status

Early POC. The project format and commands are intentionally small so they can become the shared contract used by OpenDisplay Studio Integration and the widget catalog.

## Requirements

- Node.js 20+

## Development

```bash
npm install
npm run build
npm link
```

Then create a widget anywhere:

```bash
odstudio init my-widget
cd my-widget
odstudio serve
```

The browser opens at `http://127.0.0.1:7341`. Editing `widget.liquid`, `widget.yml`, `preview.yml`, or fixture files reloads the workbench automatically.

When finished:

```bash
odstudio publish
```

This validates every configured preview span and creates:

```text
dist/
  my-widget/
    widget.yml
    widget.liquid
  my-widget-1.zip
```

`preview.yml` and `fixtures/` are development-only and are not shipped in the runtime package.

## Generated project

```text
my-widget/
  widget.yml
  widget.liquid
  preview.yml
  fixtures/
    default.yml
```

### `widget.yml`

Runtime manifest consumed by OpenDisplay Studio.

```yaml
id: my-widget
name: My Widget
version: 1
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

### `preview.yml`

Local workbench configuration. Grid dimensions are not hardcoded to TRMNL's traditional full/half/quadrant layouts.

```yaml
display:
  name: 7.5 inch 800x480
  width: 800
  height: 480
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

A smaller display can use a completely different grid, for example 2x2 or 3x2. The same widget template is rendered for every configured span.

## Liquid context

The POC uses LiquidJS 10.21.x, matching the Liquid engine family used by TRMNL's Node BYOS project. The OpenDisplay compatibility layer will be expanded as `trmnl-liquid-py` is finalized.

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
display.*
```

The workbench loads the exact framework version pinned by `widget.yml`, for example:

```text
https://trmnl.com/css/3.2.0/plugins.css
https://trmnl.com/js/3.2.0/plugins.js
```

TRMNL publishes immutable versioned framework releases. A future CLI step will cache the official framework ZIP and font bundles for fully offline development; the project format will not change when that is added.

## Architecture direction

The CLI does not own Home Assistant data providers. Fixtures emulate the normalized data contract during widget development. OpenDisplay Studio Integration will provide the real data at runtime.

Likewise, the CLI should not grow a second production renderer. Pixel-exact PNG validation will eventually call the same OpenDisplay Studio Renderer used by the Integration.
