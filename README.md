# OpenDisplay Studio CLI

Local development tooling for OpenDisplay Studio widgets.

The intended workflow is similar to modern developer CLIs such as Wrangler: create a widget project, open it in VS Code, edit one Liquid template, see the widget refresh live in several real display/grid sizes, then build a distributable package.

> **Status:** early POC. The CLI and package format are intentionally small while they become the shared contract for OpenDisplay Studio Integration and the future widget catalog.

## Requirements

- Node.js 20 or newer
- npm
- a modern browser

Check your Node.js installation:

```bash
node --version
npm --version
```

## Install the current POC

The POC currently lives on the `feature/initial-cli-poc` branch / PR #1 and is not published to npm yet.

Clone it:

```bash
git clone https://github.com/Misiu/OpenDisplay-Studio-CLI.git
cd OpenDisplay-Studio-CLI
git checkout feature/initial-cli-poc
```

Install dependencies and build the CLI:

```bash
npm install
npm run build
```

Link the local build globally so the `odstudio` command is available from any directory:

```bash
npm link
```

Verify the installation:

```bash
odstudio --version
odstudio --help
```

You should currently see version `0.1.0`.

### Updating the local POC

After pulling newer changes from the branch:

```bash
git pull
npm install
npm run build
```

Because `npm link` points at this checkout, you normally do not need to link it again.

### Removing the local CLI link

From the CLI repository directory:

```bash
npm unlink -g opendisplay-studio-cli
```

## Quick start

Create the widget somewhere **outside the CLI repository**:

```bash
cd C:\Projects
odstudio init my-widget
cd my-widget
code .
```

Start the development workbench:

```bash
odstudio serve
```

The browser opens automatically at:

```text
http://127.0.0.1:7341
```

Edit and save any of these files:

```text
widget.liquid
widget.yml
preview.yml
fixtures/*.yml
```

The workbench detects the change and refreshes automatically.

When the widget is ready:

```bash
odstudio publish
```

The command validates the configured preview variants and creates a distributable folder and ZIP under `dist/`.

## Commands

### `odstudio init <name>`

Creates a new widget project in the current directory.

```bash
odstudio init weather-card
cd weather-card
```

Generated structure:

```text
weather-card/
  widget.yml
  widget.liquid
  preview.yml
  fixtures/
    default.yml
```

`widget.yml` and `widget.liquid` are runtime files.

`preview.yml` and `fixtures/` exist only for local widget development and are not included in the published runtime package.

### `odstudio serve`

Starts the live preview workbench.

```bash
odstudio serve
```

Use another port:

```bash
odstudio serve --port 8080
```

Start without automatically opening a browser:

```bash
odstudio serve --no-open
```

The workbench renders the same `widget.liquid` template for every span declared in `preview.yml`.

For the default 800x480 / 4x2 profile this includes:

```text
4x2
2x2
4x1
2x1
1x2
1x1
```

The sizes are not aliases such as `full`, `half` or `quadrant`. They are actual `columnSpan x rowSpan` regions calculated from the selected display profile.

### `odstudio publish`

Validates the widget and builds the distributable package:

```bash
odstudio publish
```

Example output:

```text
Folder: ...\dist\my-widget
ZIP:    ...\dist\my-widget-1.zip
```

Result:

```text
dist/
  my-widget/
    widget.yml
    widget.liquid
  my-widget-1.zip
```

Development-only `preview.yml` and `fixtures/` are intentionally excluded.

## First test walkthrough

A useful first end-to-end test is:

```bash
odstudio init hello-widget
cd hello-widget
odstudio serve
```

Keep `serve` running and open `widget.liquid` in VS Code.

Change:

```liquid
<span class="title">{{ config.title }}</span>
```

to something visibly different, save the file and verify that all preview variants refresh.

Then change the display profile in `preview.yml`, for example from:

```yaml
display:
  name: 7.5 inch 800x480
  width: 800
  height: 480
  columns: 4
  rows: 2
```

to another physical display/grid definition and verify that all region dimensions are recalculated.

Finally run:

```bash
odstudio publish
```

and inspect the generated folder and ZIP.

## Project files

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

Important fields:

- `id` - stable widget identifier
- `name` - display name
- `version` - widget package version
- `framework` - exact TRMNL Framework version used by the widget
- `template` - Liquid template entry point
- `defaults` - default widget configuration
- `fields` - configuration UI schema used by OpenDisplay Studio
- `dataRequirements` - normalized runtime data dependencies

### `widget.liquid`

The presentation template. The same file is rendered for all configured region sizes.

The default generated widget is intentionally simple so it is easy to edit while testing the development loop.

### `preview.yml`

Local workbench configuration.

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

This is intentionally display-independent. A 2.6-inch display can use a 2x2 grid while an 800x480 display uses 4x2, and a larger display may use 6x4 or another layout.

The widget itself does not need separate `full.liquid`, `half.liquid` and `quadrant.liquid` templates.

### `fixtures/default.yml`

Sample configuration and normalized data used only by the workbench.

Fixtures let a widget developer reproduce states such as:

```text
normal
empty
loading-like data
many calendar events
long text
missing optional values
```

without requiring a running Home Assistant instance.

More fixtures and fixture switching in the workbench are planned after the initial development loop is validated.

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

display.*
```

For example:

```liquid
{% if region.width < 250 %}
  <span class="label">Compact</span>
{% else %}
  <span class="title">{{ config.title }}</span>
{% endif %}
```

CSS container queries are also encouraged for purely visual/responsive changes because each preview region is a CSS container.

## TRMNL Framework

The framework version is pinned in `widget.yml`:

```yaml
framework: 3.2.0
```

The current POC loads the matching immutable versioned TRMNL assets while serving previews:

```text
https://trmnl.com/css/3.2.0/plugins.css
https://trmnl.com/js/3.2.0/plugins.js
```

This means the first POC currently needs Internet access while previewing.

The next step is to cache the official versioned TRMNL Framework ZIP plus font bundles locally. That will make `odstudio serve` fully offline after the first download without changing the widget project format.

## Development of the CLI itself

Run TypeScript directly while modifying the CLI:

```bash
npm run dev -- --help
```

Run tests and type checking:

```bash
npm run check
```

Build JavaScript into `dist/`:

```bash
npm run build
```

Run tests only:

```bash
npm test
```

## Current limitations

This is the first POC. In particular:

- framework/font assets are not cached locally yet
- only one fixture is selected by `preview.yml`
- preview diagnostics do not yet report overflow
- preview does not yet generate PNG snapshots
- the CLI does not connect to Home Assistant; fixtures provide normalized development data
- full `trmnl-liquid` custom-filter/tag compatibility is still being implemented separately

These are deliberate next steps rather than responsibilities that should be hidden inside the first project format.

## Architecture

The CLI owns the developer workflow:

```text
widget project
    -> Liquid + fixture data
    -> live workbench
    -> validation
    -> distributable widget package
```

It does **not** own Home Assistant providers. OpenDisplay Studio Integration supplies real entity/calendar/etc. data at runtime using the same normalized data contract represented by fixtures.

It also should not become a second independent production renderer. Pixel-exact PNG validation will eventually use the same OpenDisplay Studio Renderer used by the Integration.
