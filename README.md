# RTM Builder

![screenshot](Screenshot.png)

Converts a flat Requirement/Test/Defect traceability table (CSV, Excel, or
Markdown) into a consolidated Requirement Traceability Matrix — one row per
requirement, with linked tests, linked defects, coverage, and defect status.

Runs entirely in the browser. No server, no build step, no dependencies to
install — open `index.html` and go.

## Project structure

```mermaid
treeView-beta
rtm-builder/
    index.html ## Page structure/markup only
    css/
        styles.css ## All styling and design tokens (CSS custom properties)
    js/
        core/ ## Pure business logic — no DOM access, reusable/testable on its own
            parsers.js ## File I/O: CSV / XLSX / Markdown → { headers, rows }
            rtm.js ## Core matrix logic (pure functions)
            diagram.js ## Builds the trace-diagram SVG from real uploaded rows
        services/ ## Cross-cutting operations — no DOM rendering
            state.js ## Single source of truth for app data (parsedTable, colMap, rtmRows, filters, pagination)
            filterService.js ## Pure filter + pagination math over RTM rows
            exportService.js ## Blob/canvas/anchor boilerplate for .md and .png downloads
        ui/ ## DOM rendering — one file per screen region
            validationView.js ## The validation banner
            statsView.js ## The stats strip
            matrixView.js ## The matrix table, filters row, and pagination controls
            diagramView.js ## The hero trace diagram and its download action
        app.js ## Thin orchestrator: wires DOM events to services/ and ui/
```

The trace diagram at the top of the page is hidden until you generate a
matrix. Once generated, it's built live from your file's actual Requirement
ID / Test Case ID / Defect ID values (capped at 6 nodes per column, with a
"+N more" indicator beyond that) — it's not sample data.

**Why split this way:** `parsers.js` and `rtm.js` have no DOM dependency, so
they can be reused or unit-tested on their own (e.g. in Node with jsdom, or
copy-pasted into another tool). `app.js` is the only file that touches the
page. If you need to change how the matrix is styled, you only ever need
`css/styles.css`. If the required columns or matrix logic change, you only
ever need `rtm.js`.

Both `parsers.js` and `rtm.js` attach to a small global namespace,
`window.RTM`, so there's no bundler or module loader involved:

```js
window.RTM.parsers.parseCSV(text)
window.RTM.core.buildRTM(table, colMap)
window.RTM.state.get()
window.RTM.filterService.applyFilters(rtmRows, filters)
window.RTM.ui.matrix.renderRows(rows)
```

## Running it

Just open `index.html` in a browser — everything works from the local
filesystem (`file://`), since there are no ES module imports, only plain
`<script>` tags.

If your browser blocks local file access for any reason, serve the folder
with any static file server, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Required columns

The uploaded file must contain a column for each of:

- **Requirement ID** — matched by header containing "req" + "id" (e.g. `REQ.IDs`, `REQ_ID`)
- **Test ID** — matched by header containing "test" + "id" (e.g. `TEST.IDs`)
- **Defect ID** — matched by header containing "def"/"defect" + "id" (e.g. `DEF.IDs`, `DEFECT.IDs`)

Matching is case-insensitive and ignores punctuation/spacing, so `REQ.IDs`,
`req_ids`, and `Req IDs` are all treated the same.

## Vendor libraries

Loaded via CDN in `index.html`, no local install needed:

- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [SheetJS (xlsx)](https://sheetjs.com/) — Excel parsing
