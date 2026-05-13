# /r/meta/schema.md

This document is the schema for the Context Graph Protocol (CGP), a the core contribution of the W3C Context Graph Community Group.

The protocol describes interfaces, not cargo. Like HTML describing a page's structure without storing pixels, like TCP describing connections without storing payloads, CGP describes what crosses a boundary — the columns, the fields, the declared shape — and leaves the values that flow through to the application's own storage. δ measures how well the interface is described; it does not measure how well individual values are annotated.

## Repository Structure

- `cgp`:    The repo root directory
- `/s`:     Observatron network using the Four Facet Model
- `/r`:     Reference URLS not on the Observatron Network
- `/e/`     Executable. Canonical specifications written as runnable code. 

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
    │   └── intent-matched.md
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
| `cgp:/r/tasks/intent-matched.md` | `/r/tasks/intent-matched.md` |
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

---
## Canonical Complete Spike

A complete, minimal spike with all four facets populated. This is the reference shape every implementer should validate against.

```json
{
  "/data": {
    "value": "hello"
  },
  "/meaning": {
    "key": [],
    "value": []
  },
  "/structure": {
    "key": [],
    "value": []
  },
  "/context": {
    "anchor": [
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0"
    ],
    "source": [
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0",
      "cgp:/s/0/o/0"
    ],
    "channel": [
      "cgp:/r/events/intent-matched.md",
      "cgp:/r/events/intent-matched.md",
      "cgp:/r/events/intent-matched.md",
      "cgp:/r/events/intent-matched.md",
      "cgp:/r/events/intent-matched.md"
    ],
    "timestamp": [
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z",
      "2026-05-02T13:23:24.034Z"
    ],
    "key": [
      "cgp:/r/keys/task.md",
      "cgp:/r/keys/component-type.md",
      "cgp:/r/keys/frame.md",
      "cgp:/r/keys/gate.md",
      "cgp:/r/keys/trigger.md"
    ],
    "value": [
      "cgp:/r/tasks/intent-matched.md",
      "cgp:/r/components/html/forms/textarea.md",
      "cgp:/r/frames/program-intent.md",
      "cgp:/r/gates/act.md",
      "cgp:/r/triggers/console-log-on-keyup.md"
    ]
  }
}
```

This spike represents a single keyup event on a textarea — the user typed, the value `"hello"` crossed the watched boundary, and the runtime matched the textarea intent's `console-log-on-keyup` trigger. `/data` carries the value verbatim per the No-Parsing Rule. `/meaning` and `/structure` are empty because no external work has declared interpretations against this payload yet. `/context` records, in five rows: the task (`intent-matched`), the component-type (`textarea`), the frame (`program-intent`), the gate (`act`), and the trigger (`console-log-on-keyup`). Every value in `/context` resolves to a real `/r/` file. `anchor` is the spike's URL; `source` is the observatron that minted it.

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

---

# First Principles for Coding Agents

These principles are diagnostic and prescriptive — consult them when designing, and again when a design starts feeling complicated.

The unifying claim: most architectural failure isn't bad code or hard problems. It's silent framing drift — solving a locally-correct problem inside a globally-wrong frame. The principles below are tools for catching that early.

## Frames inherit silently. Don't let them.

**Prioritize first principles over the existing paradigm.** Code on disk is the artifact of yesterday's understanding, not evidence the architecture is right. When extending a system, ask whether the existing shape still fits before mirroring it.

**Ask what this data is, fundamentally, before proposing structure.** If the answer is "an ordered sequence of events," the shape is event sourcing: the log is the source of truth, state is a fold over the log. Reaching for this from the start eliminates entire classes of race conditions, dedupe logic, and snapshot/live-stream gymnastics.

**Don't be seduced by "simpler because it already works."** Locally correct is not globally correct. When a shortcut preserves existing code but loses a stated invariant, name the trade-off and stop.

## Symptoms are framing signals. Read them.

**Baroque design means the frame is wrong, not the problem hard.** Double-fetches, dedupe windows, timestamp races, payload comparisons — these are tells. When a design starts requiring them, drop down to the data shape and re-derive the architecture rather than patching the symptom.

**Prefer one source of truth with derived views over multiple parallel stores.** Any time the same information is represented in two places, the two will drift. A log with a stateless reducer beats a log plus a separately-maintained state aggregator, even when the second already works.

**Don't store what can be computed.** Diffs, aggregations, and caches derived from the log are computations, not state. Storing them creates synchronization burden for no information gain.

## The principal's frame is load-bearing. Surface conflicts; don't resolve them silently.

**Treat the stated goal as architecturally binding.** A feature described as desirable (e.g., time-travel debugging) implies invariants (e.g., state is a pure function of the log) that constrain the design space. Walking back from those invariants to preserve existing code is a defect, not a simplification. If a goal and a proposed path conflict, surface the conflict.

**The principal decides; the implementer surfaces.**

## Operating Context

This is an engineering inspection tool. The operator is the engineer who runs the server, owns the data, and is the only audience for anything the system surfaces. There are no other users, no privacy boundaries between participants, no need to filter what one component reveals to another. Everything the system observes is, by construction, available to the operator.

Apply this when evaluating design choices: if a proposed mechanism exists to restrict visibility between parts of the system, ask what audience it is protecting against. If the answer is "no one," delete the mechanism.

---

# META SCHEMA

* system                              [URL: `cgp:/s/<s>`]
   * observatron                      [URL: `cgp:/s/<s>/o/<o>`]
      * /data
         * value                      (object — the cgp-* attributes from activation)
      * /meaning
         * key                        (array — symbols)
         * value                      (array — definitions, parallel to key)
      * /structure
         * key                        (array — schema kinds, e.g. "json-schema-2020-12")
         * value                      (array — schema bodies, parallel to key)
      * /context
         * anchor                     (array — URL of the node this row is about)
         * source                     (array — URL of the observatron that emitted)
         * channel                    (array — URL of the event channel)
         * timestamp                  (array — ISO 8601 UTC)
         * key                        (array — claim key URL)
         * value                      (array — claim value URL or literal)

      * spike                         [URL: `cgp:/s/<s>/o/<o>/c/state-change/<n>/a/<n>/p/<n>`]
         * /data
            * value                   (array — the data the spike carries)
         * /meaning
            * key                     (array — symbols)
            * value                   (array — definitions, parallel to key)
         * /structure
            * key                     (array — schema kinds)
            * value                   (array — schema bodies, parallel to key)
         * /context
            * anchor                  (array — URL of this spike, repeated per row)
            * source                  (array — URL of parent observatron, repeated per row)
            * channel                 (array — URL of the event channel, repeated per row)
            * timestamp               (array — ISO 8601 UTC, repeated per row)
            * key                     (array — claim key URL, varies per row)
            * value                   (array — claim value URL or literal, varies per row)

---

## CRITICAL TO REMEMBER

### The /data facet is canonical; /meaning, /structure, and /context are projected onto it.

The four facets are not symmetric. /data records what crossed the
boundary. The other three are interpretive layers added over /data
by external work — by humans declaring meaning, by consumers
declaring schemas, by the runtime recording the crossing event in
/context.

Empty /meaning and empty /structure are the honest state until
external work has been done. The runtime must not populate them
from /data's content. Doing so fabricates interpretation that has
not actually been done, and corrupts the metric (dark fraction)
that measures how much interpretation has been done.

### The runtime never infers meaning from data.

A CSV's first row may look like column headers. A blob of text may
look like JSON. A number may look like a timestamp. The runtime
sees none of this. It records what crossed verbatim and stops.

Pattern-matching on data content to populate /meaning, /structure,
or /context is forbidden. If meaning needs to be declared, an
external agent declares it — by writing to /meaning explicitly,
or by an intent map's handler producing it as a spike's payload.
The runtime is a witness, not an interpreter.

### Spike granularity is a policy decision, not a protocol law.

How a payload becomes spikes is declared in the cgp-intent map. One
boundary crossing can mint one spike (the whole payload), N spikes
(one per part the policy carved out), or zero spikes (no policy
matched).

When no intent is declared, the runtime applies a default policy.
The default is a choice the implementer makes — not a protocol
truth. Documenting the default is required; treating the default as
"how the protocol works" is wrong. The protocol works however the
policy says.

For the alpha drag-and-drop component, the default policy carves
one spike per column. This is documented in cgp:/r/policies/parse-csv-headers.md
and is overridable by an intent map declaring a different policy.

### Don't promote data to meaning.

The most common failure mode of the no-parsing rule is subtle:
treating part of the data as "labels" or "names" and routing them
to /meaning while the rest goes to /data. This is data partitioning
disguised as meaning extraction.

If the boundary crossing carried the bytes, those bytes are /data.
If the bytes happen to be human-readable names, that does not make
them meaning. Meaning is a separate facet populated by separate
work. Resist the urge to "be helpful" by pre-populating /meaning
from /data — the helpfulness is a violation.




----
# Schema.md Additions

The following three sections are intended to be pasted into `/r/meta/schema.md`. They establish the URL spaces of the protocol, the intent map foundation, and the predicate vocabulary.

---

## URL Spaces

The protocol uses three top-level URL spaces. Every URL in the protocol resolves into exactly one of them, and each space has a different mode of existence.

**`/r/`** — Reference. Prose declarations and documentation. The things you read. Component descriptions, channel definitions, key registries, policy descriptions, frame descriptions. Reference URLs are documents — they describe what something is, in human language, normatively.

**`/s/`** — Systems. Live entries. The things being witnessed. Observatrons watching boundaries, spikes recording crossings. System URLs change as the protocol witnesses new boundary events; they are the protocol's running state.

**`/e/`** — Executable. Canonical specifications written as runnable code. The things that run. Policies, predicates, and any other rule whose behavior must be precisely defined. Executable URLs identify the canonical implementation of a behavior — runnable, testable, the source of truth for what the rule does.

A single conceptual thing — a policy, for instance — typically appears twice in URL space: once as a description in `/r/`, once as an executable specification in `/e/`. The two URLs share their tail path:

```
cgp:/r/policies/parse-csv-headers.md      ← prose declaration
cgp:/e/policies/parse-csv-headers.js      ← canonical executable specification
```

The description explains what the policy is and why. The executable spec is what runs. Together they form the complete protocol contract for that policy: anyone implementing it in another language can read the description for context and the spec for behavior, and verify their implementation against the spec's outputs.

The choice of JavaScript for executable specifications in alpha is pragmatic — it matches the alpha runtime's language and is generated reliably by current tooling. This is not a long-term protocol commitment; future versions may introduce executable specifications in additional languages or in formal mathematical notation.

---
## Intent Map

An intent map is an in-memory notepad shared by three parties — system, user, and organization — during a session. Each party writes into its own frame. The notepad lives in memory for the duration of the session; persistence, if any, is the concern of other modules.

### The three frames

- **`program-intent`** — the system's section. Engineering-defined behavior at the boundary.
- **`user-intent`** — the user's section. User responses, user-set policies, user-declared intents during the session.
- **`business-intent`** — the organization's section. Compliance, audit, policy concerns.

Each frame can be updated in real time by its owner during the session. The frames coexist — a single boundary crossing may match triggers in any combination of frames.

### The three decision gates

Within each frame, triggers are grouped under three gates that name what the system must do:

- **`halt`** — block the in-flight action.
- **`ask`** — pause and request input from the user.
- **`act`** — proceed and act on the data.

Decision gates name *what to do*, not *how bad it is*. They replace severity-style vocabularies (`error`/`warning`/`info`).

### Trigger shape

Each gate holds an array of triggers. A trigger is a predicate-list paired with a handler payload:

```json
{
  "predicates": [
    { "type": "<predicate-name>", "...": "predicate-specific fields" }
  ],
  "handler": { "...": "handler payload" }
}
```

The trigger fires when all predicates in the array return true (AND semantics). When the trigger fires, the handler payload is delivered verbatim to the component's handler code.

Predicates are opaque to the runtime — any function returning a boolean. Examples: `event` (a named DOM event occurred), `regex` (input matches a pattern), `match` (input contains a string). New predicate types are added by creating new entries under `cgp:/r/predicates/`.

### Intents: how intent maps are stored and referenced

An intent is declared in three parallel filesystem trees, all keyed by the same tail path:

| Tree | Purpose |
|---|---|
| `cgp:/r/intents/<path>.md` | Prose declaration of the intent. Names the JSON and JS paths below. |
| `/intents/<path>.json` | The intent-map JSON (the notepad's initial seed). |
| `/handlers/<path>.js` | The handler code that consumes the intent map and acts on it. |

A reader who finds any one of the three files can derive the other two by substituting the prefix.

### How an HTML element wires it up

```html
<div cgp-id="cgp:/r/components/html/forms/textarea.md"
     cgp-system-id="0"
     cgp-observatron-id="0"
     cgp-target=".textarea"
     cgp-intent="cgp:/r/intents/components/html/forms/textarea.md">
  <textarea class="textarea"></textarea>
</div>
```

The `cgp-intent` attribute holds a single URL — the intent's `/r/` declaration. The runtime fetches that doc, reads the JSON and JS paths it names, loads both, and wires the handler to the intent map.

### Canonical intent map

```json
{
  "program-intent": {
    "halt": [],
    "ask":  [],
    "act":  [
      {
        "predicates": [
          { "type": "event", "event": "keyup" }
        ],
        "handler": { "console-log": true }
      }
    ]
  },
  "user-intent":     { "halt": [], "ask": [], "act": [] },
  "business-intent": { "halt": [], "ask": [], "act": [] }
}
```

This is the textarea intent in canonical form: on keyup, console.log the value. One trigger, one predicate, one handler instruction. Every other intent is a richer instance of the same shape.

### How a trigger is evaluated

1. The runtime sees a boundary crossing on an observatron.
2. The runtime walks each frame (`program-intent`, `user-intent`, `business-intent`), each gate (`halt`, `ask`, `act`), and each trigger within.
3. For each trigger, the runtime evaluates every predicate in the `predicates` array.
4. If all predicates return true, the trigger fires.
5. The trigger's `handler` payload is delivered to the intent's handler code (the `.js` file named in the intent's `/r/` doc).
6. What the handler does is the handler's responsibility — log, mint spikes, update DOM, whatever the intent declares. The runtime witnesses; the handler acts.

### Channel

When a trigger fires and the handler mints spikes, those spikes emit on a single uniform channel:

`cgp:/r/events/intent-matched.md`

The spike's `/context` records which frame, gate, and trigger produced it, so observers can trace the crossing back to the declared intent. Per-event channels like `csv-dropped` are no longer defined as protocol-level events; CSV-drop handling is now expressed as a trigger inside the drag-and-drop intent, and its spikes flow through `intent-matched`.
---

# External-facing Protocol Rules
# Tree Footer (Markdown)

When a CGP-conformant document is written in markdown — a blog post, an essay, a community update, a section of documentation — the document itself is the entry. Like an HTML element bearing a `cgp-id`, a markdown document declares its identity, taxonomy position, and intent through a small visible footer.

The footer is human-readable. The same characters that draw the tree for a reader form a parseable structure for a machine. Visible signature and protocol annotation are the same artifact.

## Shape

A CGP markdown document MAY end with a tree footer. The footer is delimited by a horizontal rule and renders the document's position in the cognitive primitive taxonomy.

```
▾ cgp(<optional params to observatron>)
        ▾ Context Graph Protocol
                · URL Spaces
                · Four Facet Model
                · Intent Map
                · Predicates
                · Markdown Annotation
                ▾ Formal Foundations
                        ✓ Executable Specification Environment
```

### Glyph vocabulary

| Glyph | U+ | Role |
|---|---|---|
| `▾` | U+25BE | Open folder. The branch is expanded; its children are listed beneath it. |
| `▸` | U+25B8 | Closed folder. The branch is collapsed; its children are not shown. |
| `·` | U+00B7 | Leaf, not selected. A terminal node that is not the document's location. |
| `✓` | U+2713 | Leaf, selected. The "you are here" marker — the single node this document is about. |

### Six states, four glyphs

The vocabulary distinguishes six structural states using four glyphs. Two pairs of states share a glyph because the surrounding structure disambiguates them:

| State | Glyph | Disambiguated by |
|---|---|---|
| Open folder with content | `▾` | Children are listed at the next indent level |
| Open folder, empty | `▾` | No children appear at the next indent level |
| Closed folder with content | `▸` | Reader knows it could be opened (snapshot does not declare) |
| Closed folder, empty | `▸` | Same — closed is closed; content status is not part of the snapshot |
| Leaf, not selected | `·` | Terminal node, not the document's location |
| Leaf, selected | `✓` | Terminal node, the document's location (exactly one per tree) |

This matches the convention of every standard tree-view UI (Finder, file explorers, IDE outlines): a caret-right means "closed," a caret-down means "open," and the structure beneath determines whether content exists.

### Rules

- Each tree MUST have exactly one `✓`. The `✓` is the document's location in the taxonomy.
- Each level of the tree MUST have at most one `▾` (open folder being descended through). A document descends exactly one path; other siblings at that level appear as `▸` (closed folders) or `·` (leaves).
- The path from the root `▾` to `✓` MUST be a contiguous chain of `▾`s terminating in `✓`.
- Indentation marks depth. Use whitespace; exact width is a presentation choice.
- The footer is OPTIONAL. A markdown document without a tree is still a markdown document; it is just not declaring a CGP location.

### Examples of each state

```
▾ Folder 1 (open, has children)
        ▸ Folder 2 (closed, has children — collapsed)
        ▾ Folder 3 (open, has children)
                · File 1 (leaf, not selected)
                ✓ File 2 (leaf, selected — "you are here")
                · File 3 (leaf, not selected)
        ▸ Folder 4 (closed, empty)
        ▾ Folder 5 (open, empty)
        · File 4 (leaf at this level, not selected)
```

## Mapping to the Four Facet Model

The footer is the document's `/context`, rendered for humans.

| Tree element | Maps to |
|---|---|
| Root node | The cognitive primitive (root key in `cgp:/r/keys/`) |
| Path of `▾`s | The namespace path under that key |
| `✓` leaf | The `value` for this entry's `key` row in `/context` |
| The document body | `/data` |

A reader who scans the tree sees the document's namespace. A machine that parses the tree obtains the same information as a `/context` row.

A future tool MAY hydrate the tree into a `/context` table by walking glyphs in order. This is not a runtime requirement; the tree is normative for humans and advisory for machines.

## Growth Model

A markdown document's tree is **frozen at write time**. It is a snapshot of the taxonomy as it existed at the moment of authoring.

This is deliberate. The tree IS the provenance.

- If the taxonomy grows after the document is written, the document does not update. Its tree continues to reflect the taxonomy of its era.
- If a node is renamed, moved, or removed in the canonical taxonomy, the old document still names it as it was. The discrepancy is a historical record, not a defect.
- Reading documents in chronological order, by tree, recovers the history of how the taxonomy evolved.

This is provenance without a provenance system. There is no version field, no migration step, no audit log. The artifact carries its own history because the tree at the bottom of the document is the taxonomy at the time of writing.

### Additive convention

Taxonomy changes are additive. New nodes are added; existing nodes are not renamed or moved. When a node must change, the old path is preserved and a new path is introduced alongside it. This keeps historical trees machine-resolvable against the current taxonomy registry: every `✓` ever written still dereferences to a `cgp:/r/keys/<path>.md` file, even if newer documents no longer use that path.

A document MAY include a comment naming the taxonomy version it was written against, but this is not required. The tree itself is sufficient.

## Example

A markdown post ending with a tree footer:

````markdown
# 79% of multi-agent failures had nothing to do with the model

That's from the MAST study (Cemri et al.). Specification gaps.
Inter-agent misalignment. Verification holes.

Call it what it is: a stability problem.

[...body of the post...]

The moat is the harness, not the model.

---

▾ cgp(<optional params to observatron>)
        ▾ Stability
                · What it means
                · Why it's required for coordination
                ▾ Continuous cleaning pipeline
                        ✓ Errors propagate and reinforce
````

A reader sees the argument and a footer locating it under *Stability → Continuous cleaning pipeline → Errors propagate and reinforce*. A machine sees the same. The tree is the contract.

## Two Boundaries

The Tree Footer convention applies to two distinct boundary classes, using the same primitives in both.

**Inward boundary.** Specification documents cross from author to implementer. The Tree Footer on a spec section locates that section within the protocol's own taxonomy. Dark fraction at this boundary is the gap between what the spec means and what an implementer reads it to mean.

**Outward boundary.** Public documents cross from author to discourse. The Tree Footer on a published document locates that document within the author's cognitive primitive taxonomy. Dark fraction at this boundary is the gap between what the author means and what the reader receives.

Both boundaries are governed by the same four facets, the same URL spaces, and the same Tree Footer notation. The protocol does not distinguish them; they are the same shape applied to different surfaces.

A protocol that requires different primitives for self-description than for external content is leaking a structural assumption. CGP does not. The Tree Footer applied to schema.md is the same convention as the Tree Footer applied to a public post — same glyphs, same rules, same mapping to the four facets. This is a conformance property, not a stylistic choice.

## Propagation as `/context`

A published document has more than one boundary crossing. The initial publication is the first; every subsequent share, quote, citation, or repost is another crossing on the same observatron.

Each downstream crossing is a spike under the original document's observatron. The spike's `/context` records who interacted, when, on what channel, and (where available) what the downstream payload was. Over time, the observatron accumulates a log of how the document's meaning propagated.

This reframes analytics. Conventional metrics (reach, impressions, engagement counts) measure volume. The `/context` log measures fidelity: at each downstream crossing, how much of the original meaning survived. A repost that preserves the claim is a coherent crossing; a repost that mutates the claim into something the author would not endorse is a dark-fraction event, observable as a discrepancy between upstream `/data` and downstream `/data`.

Tooling that consumes a document's full `/context` log produces a propagation graph: the document at the root, every downstream interaction as a node, the meaning-preservation ratio as the edge weight. Conventional analytics produce a number. CGP analytics produce a graph with provenance.

## Self-Reference

The Tree Footer convention applies to schema.md itself. This document is a CGP entry; its footer locates it in the protocol's own taxonomy. The schema describes the annotation mechanism; the annotation conforms to the schema it describes.

This is the conformance check that proves the protocol does not require special-casing for its own documentation. If schema.md required a different annotation mechanism than the documents it governs, the protocol would be leaking a structural assumption. It does not.

The same Tree Footer convention, the same four-facet shape, and the same URL spaces govern the inward and outward boundaries with no modification. A retrieval system built over a corpus of CGP-annotated public documents and a retrieval system built over the spec's own sections are the same system pointed at different file trees.

For example, the same tree footer below can be:
- written at the bottom of a `.md` file in `/r/` for human readers
- added to the `/context` facet as a row in a key-value pair in `/s/`
- added to `/e/` for navigation by runtime tooling

---

▾ cgp(<optional params to observatron>)
        ▾ Context Graph Protocol
                · URL Spaces
                · Four Facet Model
                · Intent Map
                · Predicates
                · Markdown Annotation
                ▾ Formal Foundations
                        ✓ Executable Specification Environment


----
## `/e/` — Mathematical specifications

The `/e/` URL space holds canonical mathematical specifications of protocol behavior. Math is the universal language; any implementation (JavaScript, Python, Rust) is a translation from the math.

This is the same posture as a proof assistant. In Lean, Coq, or Agda, a theorem is a type and a proof is a program; any other proof of the same theorem is conformant if it inhabits the same type. The math is the source of truth, the runnable form is one expression of it. CGP applies the same posture at the protocol layer: the math in `/e/` is canonical, and any implementation is conformant if it produces equivalent outputs for equivalent inputs.

Two practical consequences:

- **Implementations are interchangeable.** A handler written in JavaScript and a handler written in Python that both compile from the same `/e/` expression are equally valid. The protocol cares about the math, not the language.
- **Agents can derive code from math.** Given an `/e/` expression, an agent can generate an implementation in whatever language the runtime needs. The math is the brief; the code is one realization of that brief.

The dark fraction δ — the protocol's headline metric — is itself defined in math. Writing it once, in Unicode, gives every implementation a single reference point to converge on.

### Scope in alpha

`/e/` is reserved space in alpha. Handlers are referenced by filesystem path from the policy's `/r/` doc, and the implementation language is whatever the runtime supports. The `/e/` infrastructure — a compiler from math to code, a conformance test harness, full mathematical notation for every protocol function — is a future project.

What exists in alpha is one canonical example, planted to show the shape `/e/` will take.

### Canonical example

The textarea policy's handler — "on keyup, log the input" — expressed in pure math:

```
log : 𝕊 → ()
log(x) = emit(x)
```

A function from strings (𝕊) to unit (()), whose effect is to emit its input. This specification is language-neutral. A future compilation produces `/handlers/components/html/forms/textarea.js`, or a Python equivalent, or any other implementation. Each implementation is a translation; the math is the source of truth.

This is the entire `/e/` commitment for alpha: math is canonical, implementations are downstream, and one example exists to prove the concept holds.