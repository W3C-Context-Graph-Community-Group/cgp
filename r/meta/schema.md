# /r/meta/schema.md

This document is the schema for the Context Graph Protocol (CGP), a the core contribution of the W3C Context Graph Community Group.

## Repository Structure

- `cgp`:    The repo root directory
- `/s`:     Observatron network using the Four Facet Model
- `/r`:     Reference URLS not on the Observatron Network

---

## Default CGP Example File structure

The repo is laid out as a static tree of files. Every URL in the protocol resolves to a real file on disk; there is no slugifier, no router, no build step.

```
<repo-root>/
└── r/                                  
    ├── meta/
    │   ├── schema.md
    ├── schemas/
    │   ├── observatron.schema.json
    │   └── spike.schema.json
    ├── keys/    
    │   ├── task.md
    │   └── component-type.md
    ├── tasks/    
    │   └── csv-dropped.md
    └── components/        
        └── html/
            └── forms/
                └── drag-and-drop.md
```

Sub-directories under a catalog are fine wherever the structure helps a human navigate (e.g., `components/html/forms/drag-and-drop.md`). The protocol does not care about category structure; URLs just resolve to file paths.

---

## URL Resolution

A `cgp:/r/<path>` URL resolves literally:

1. Strip the `cgp:/r/` prefix.
2. Fetch the rest as a file path on the implementation's host.

That is the entire rule. No fragment handling, no defaulting, no transformation, no format inference.

### Examples

| URL | File served |
|---|---|
| `cgp:/r/keys/task.md` | `/r/keys/task.md` |
| `cgp:/r/components/html/forms/drag-and-drop.md` | `/r/components/html/forms/drag-and-drop.md` |
| `cgp:/r/tasks/csv-dropped.md` | `/r/tasks/csv-dropped.md` |
| `cgp:/r/policy.json` | `/r/policy.json` |

Resolution works on any static-file host: GitHub, GitLab, S3, raw filesystem.

---

### URLs Carry Extensions

URLs MUST carry the file's extension explicitly. No default extension, no implicit format.

**Correct:** `cgp:/r/keys/task.md`, `cgp:/r/policy.json`, `cgp:/r/diagram.svg`

**Incorrect:** `cgp:/r/keys/task`, `cgp:/r/policy`

The reader knows the format from the URL alone. The host serves the file without any path rewriting.

---

#### One File Per Entry

Each addressable thing is its own file. Catalogs are directories, not single files containing many entries.

**Adding an entry:** create a new file at the appropriate path. The path is the URL.

**Why:** URL fragments depend on a renderer's slugifier (`# Task` → `id="task"` on GitHub, but rules vary). Eliminating fragments means eliminating that dependency. One entry per file, addressed by full path, fetched literally.

It also makes adding entries pure-append: a new file, no editing of existing content, no risk of name collision, separate diff history per entry.

---

### Validation

The shape of every entry is enforced by JSON Schema:

- `observatron.schema.json` — validates observatron entries
- `spike.schema.json` — validates spike entries

Both schemas live at the repo root. The event bus loads them at startup and validates every emission before broadcasting. Non-conformant emissions are rejected and logged, not propagated.

The schemas encode every rule defined in the Four Facet Model section above. If an emission passes the schemas, it is conformant; if it fails, the schema's error path tells you which rule was violated.

## Four Facet Model

The atomic unit on the graph is the `observatron`. `Spikes` live under observatrons. A system is the bounding box that observatrons live in — a namespace, not an observed thing.

When you instantiate the runtime, what you're actually instantiating is an observatron. 

**On systems.** A system (`cgp:/s/<id>`) is the bounding box an observatron lives in — a namespace, not an entry. Systems do not have facets; they are not minted by a boundary-crossing of their own. The system comes into being implicitly as the scope of its observatrons. Only observatrons and spikes are entries on the graph.

**On spikes.** A spike does not have a boundary independent of its observatron. The observatron's watched interface is the boundary; what crosses it produces a spike under that observatron. Spikes are always downstream of observatrons.

### Coupling Rule

An entry on the Context Graph (spike or observatron) exists if and only if a payload has crossed a boundary to bring it into being.

- For a **spike**: a datum crossing the observatron's boundary mints the spike.
- For an **observatron**: instantiation parameters crossing from the host (e.g., an HTML element) mint the observatron.

When an entry exists, all four facets are present. The shape is:

| Facet | When entry exists |
|---|---|
| `/data` | `{ "value": <payload> }` — the payload that minted the entry |
| `/meaning` | columnar table with `key` and `value` columns; rows may be empty or populated |
| `/structure` | columnar table with `key` and `value` columns; rows may be empty or populated |
| `/context` | columnar table with six columns; first two rows record the task and the component-type under which the entry was created |

There is no state in which an entry exists with `null` facets. If the facets would be null, the entry does not exist.

---

### No-Parsing Rule

The protocol records what crossed the boundary verbatim. No parsing, no transformation, no normalization.

- If an HTML attribute carries a string, `/data` records that string.
- If an attribute carries a JSON-encoded object as a string, `/data` records the string — not the parsed object.
- If a CSV cell contains the text `"123"`, `/data` records `"123"` — not the number `123`.
- Attribute names cross verbatim. `cgp-intent` in HTML appears as the key `"cgp-intent"` in `/data`.

Whoever consumes `/data` may parse it later — that is the consumer's responsibility, declared via `/structure`. The protocol's only job is to record the raw payload faithfully.

---

## Spikes: Four Facet Model Objects

### Facet #1 — Data

#### `/data`

`/data` carries whatever crossed the boundary as a payload. The wrapper shape is always `{ "value": <payload> }`, where `<payload>` is any JSON value (including empty values like `""`, `[]`, `{}`).

- For an observatron, the boundary is instantiation. The payload is the instantiation parameters that brought the observatron into being. Common shapes: HTML element attributes, an intent map, a configuration object.
- For a spike, the boundary is the observatron's watched interface. The payload is the datum that crossed it.
- One boundary event = one payload.
- Payload shape is unconstrained; `/structure` declares how it could be validated.
- Payload is recorded verbatim. See **No-Parsing Rule** above.

---

### Facet #2 — Meaning

#### `/meaning`

- MUST have exactly two columns: `key` and `value`.
- MUST contain only human-readable definitions.
- MAY have any number of rows: zero, one, or many.
- MUST NOT contain tags, schemas, or any other column.

**Example**

```json
{
  "/meaning": {
    "key": [
      "peanut butter",
      "chocolate",
      "peanut butter & chocolate"
    ],
    "value": [
      "A spread made from ground roasted peanuts.",
      "A confection made from cacao beans.",
      "A classic flavor pairing — the salty richness of peanut butter complements the sweetness of chocolate."
    ]
  }
}
```

This shape supports:

- A single term being defined (one row)
- Multiple unrelated terms in the same entry (many rows, no relationship)
- Atoms plus their composition (rows for parts, plus a row for the whole)

**Empty** (no definitions yet):

```json
{
  "/meaning": {
    "key": [],
    "value": []
  }
}
```

---

### Facet #3 — Structure

#### `/structure`

- MUST have exactly two columns: `key` and `value`.
- `key` names the schema language (e.g., `json-schema-2020-12`, `regex`).
- `value` carries the schema as a string in the form native to that schema language.
- MAY have any number of rows: zero, one, or many. Multiple rows = multiple schemas (in different languages) declared against the same `/data`.
- MUST NOT contain configuration, descriptions, or runtime behavior.

The protocol provides the slot for declaring a schema; it does not perform validation. `/structure` exists so that dark fraction can count it as a verifiable facet.

#### Examples

**JSON Schema**
```json
{
  "/structure": {
    "key": ["json-schema-2020-12"],
    "value": ["<schema as string>"]
  }
}
```

**Regex**
```json
{
  "/structure": {
    "key": ["regex"],
    "value": ["^[0-9]{4}-[0-9]{2}-[0-9]{2}$"]
  }
}
```

**Empty** (no constraints declared):

```json
{
  "/structure": {
    "key": [],
    "value": []
  }
}
```

---

### Facet #4 — Context

#### `/context`

- MUST have exactly six columns: `anchor`, `source`, `channel`, `timestamp`, `key`, `value`.
- All six columns are parallel arrays of equal length.
- MUST be a time-ordered log of events.
- MUST NOT contain configuration, schemas, or human-readable descriptions outside the event log.

**The first two rows of `/context` MUST record the task and the component-type under which the entry was created.** Without these, the data has no external grounding — a reader can see what crossed but not what for or by what kind of thing. Together they answer: *what was happening, and what kind of thing produced this, such that this entry came into being?*

Subsequent rows record events that happen to the entry over time.

**Column definitions**

| Column | Plain-English question | Holds |
|---|---|---|
| `anchor` | What entry is this row about? | URL of the entry being described. Invariant across all rows of one entry. |
| `source` | Who wrote this row? | URL of the observatron that emitted the row. In alpha, equal to the owning observatron of the entry; in beta, can differ when one observatron writes into another's `/context`. |
| `channel` | What kind of thing is this row recording? | A `cgp:/r/<path>` URL naming the kind of event. The conduit, in Shannon's sense — the named channel two observatrons agree on for this kind of transmission. |
| `timestamp` | When was this row written? | ISO 8601 UTC, millisecond precision. |
| `key` | What property of the entry is this row asserting? | A `cgp:/r/keys/<key-name>.md` URL naming the property kind. |
| `value` | What is the asserted property's content? | Either a `cgp:/r/<path>` reference or a literal string. |

Read row N as a sentence: *at `timestamp[N]`, observatron `source[N]` recorded — on channel `channel[N]` — that the entry at `anchor[N]` had `key[N]` = `value[N]`.*

**The minting rows.** The first row's `key` is `cgp:/r/keys/task.md` and its `value` is a `cgp:/r/tasks/<task-name>.md` reference. The second row's `key` is `cgp:/r/keys/component-type.md` and its `value` is a `cgp:/r/components/<component-name>.md` reference. Both rows share the same `anchor`, `source`, `channel`, and `timestamp` — they are two facts about the same minting event. The channel column on these rows records the minting event (`cgp:/r/events/activated.md` for observatrons; `cgp:/r/events/csv-dropped.md` or other minting events for spikes).

**Note on `anchor` and `source`.** They are different questions even when they hold the same value. `anchor` is *what* the row is about; `source` is *who* wrote it. For an observatron's own row, anchor and source are equal (the observatron writes about itself). For a spike's row, they differ (the observatron writes about a spike beneath it). In beta, when one observatron writes into another's `/context`, anchor and source can differ on observatron rows too. The columns are kept distinct so the rule is uniform across all cases.

**Example**

```json
{
  "/context": {
    "anchor": [
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0"
    ],
    "source": [
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0"
    ],
    "channel": [
      "cgp:/r/events/csv-dropped.md",
      "cgp:/r/events/csv-dropped.md"
    ],
    "timestamp": [
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z"
    ],
    "key": [
      "cgp:/r/keys/task.md",
      "cgp:/r/keys/component-type.md"
    ],
    "value": [
      "cgp:/r/tasks/csv-dropped.md",
      "cgp:/r/components/html/forms/drag-and-drop.md"
    ]
  }
}
```

This is a spike's `/context`. Note `anchor` (the spike's URL) differs from `source` (the observatron's URL) — the observatron at `cgp:/s/0/o/0` wrote rows about its own spike at `cgp:/s/0/o/0/c/state-change/0/a/0/p/0`.

---

## Alpha Events

Alpha defines exactly two events.

| Event URL | Fired when |
|---|---|
| `cgp:/r/events/activated.md` | An observatron is instantiated. Announces the observatron exists. |
| `cgp:/r/events/csv-dropped.md` | A CSV file is dropped on the watched boundary. Mints one spike per column. |

No other events exist in alpha. The drag-and-drop scenario produces only these two kinds of `/context` row at minting time.

---

## Canonical Complete Spike

A complete, minimal spike with all four facets populated. This is the reference shape every implementer should validate against.

```json
{
  "/data": {
    "value": ["2026-01-15", "2026-01-16", "2026-01-17"]
  },
  "/meaning": {
    "key": ["Date"],
    "value": ["The trade execution date in ISO format."]
  },
  "/structure": {
    "key": ["json-schema-2020-12"],
    "value": ["{\"type\":\"array\",\"items\":{\"type\":\"string\",\"format\":\"date\"}}"]
  },
  "/context": {
    "anchor": [
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0"
    ],
    "source": [
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0"
    ],
    "channel": [
      "cgp:/r/events/csv-dropped.md",
      "cgp:/r/events/csv-dropped.md"
    ],
    "timestamp": [
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z"
    ],
    "key": [
      "cgp:/r/keys/task.md",
      "cgp:/r/keys/component-type.md"
    ],
    "value": [
      "cgp:/r/tasks/csv-dropped.md",
      "cgp:/r/components/html/forms/drag-and-drop.md"
    ]
  }
}
```

This spike represents a single CSV column ("Date") that crossed a drag-and-drop boundary under the `csv-dropped` task. `anchor` is the spike's URL; `source` is the observatron that minted it.

---

## Canonical Complete Observatron

An observatron minted when an HTML element instantiates it. The instantiation parameters are the payload, recorded verbatim.

```json
{
  "/data": {
    "value": {
      "cgp-system-id": "0",
      "cgp-observatron-id": "0",
      "cgp-target": ".drop-zone",
      "cgp-intent": "{\"cgp-policy\":\"cgp:/r/policies/parse-csv-headers.md\"}"
    }
  },
  "/meaning": {
    "key": ["watches CSV columns"],
    "value": ["Observes drag-and-drop CSV files and emits one spike per column."]
  },
  "/structure": {
    "key": [],
    "value": []
  },
  "/context": {
    "anchor": ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "source": ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel": [
      "cgp:/r/events/activated.md",
      "cgp:/r/events/activated.md"
    ],
    "timestamp": [
      "2026-05-02T13:22:55.774Z",
      "2026-05-02T13:22:55.774Z"
    ],
    "key": [
      "cgp:/r/keys/task.md",
      "cgp:/r/keys/component-type.md"
    ],
    "value": [
      "cgp:/r/tasks/csv-dropped.md",
      "cgp:/r/components/html/forms/drag-and-drop.md"
    ]
  }
}
```

The observatron exists because instantiation parameters crossed the boundary. `/data` carries those parameters verbatim — every key prefixed with `cgp-`, every value as a raw string. `/meaning` describes what the observatron does in human terms. `/structure` is empty because no schema for instantiation parameters has been declared. `/context` records the activation event under the `csv-dropped` task and the `html/forms/drag-and-drop` component-type. Note that `anchor` and `source` are equal — the observatron is writing about itself.

---

## Instantiation

### System instantiates an Observatron

The host page declares the observatron:

```html
<div cgp-id="cgp:/r/components/html/forms/drag-and-drop.md"
     cgp-system-id="0"
     cgp-observatron-id="0"
     cgp-target=".drop-zone"
     cgp-intent="{...}">
</div>
```

The attribute set crosses the boundary verbatim and becomes the observatron's `/data`:

```json
{
  "/data": {
    "value": {
      "cgp-id": "cgp:/r/components/html/forms/drag-and-drop.md",
      "cgp-system-id": "0",
      "cgp-observatron-id": "0",
      "cgp-target": ".drop-zone",
      "cgp-intent": "{...}"
    }
  }
}
```

The `cgp-intent` value is the literal HTML attribute string, not a parsed object.

### The `cgp-id` Stamping Model

Any HTML element with a `cgp-id` attribute is a CGP element. The runtime queries the DOM for `[cgp-id]`, reads each element's `cgp-id` URL to determine what kind of component it is, and instantiates the corresponding observatron.

The element's tag (`<div>`, `<span>`, `<canvas>`, etc.) is the implementer's choice — pick whatever fits semantically. The CGP identity is carried entirely by the `cgp-id` attribute, not by the tag name. This makes the protocol tag-agnostic: a CGP component can be stamped onto any HTML element.

The URL in `cgp-id` is the canonical name for the component. There is no separate registration step, no custom-element definition, no naming convention to translate. The URL points to the component's reference file (e.g., `cgp:/r/components/html/forms/drag-and-drop.md`); whatever lives at that URL is what the element is.