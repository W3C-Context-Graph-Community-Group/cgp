# Context Graph Protocol — Getting Started Guide

When you hand an AI agent "2026-01-15" in a Date field, the agent makes assumptions.

Is this a trade date or a birthday? ISO format or US ordering? What timezone? Is "yesterday" already resolved, or is the agent about to resolve it from its own context?

Those assumptions drive the output. They determine whether the answer is right or wrong. But today they're invisible — and you can't fix what you can't see.

Without a shared coordinate system, you can't even tell there's something to measure. The dark assumptions stay dark because there's no geometry to locate them in.

We call the fraction of assumptions that are operating without being named **Dark Uncertainty**. It is computable, reducible, and — crucially — a prerequisite for anything else.

## Important Information 
Please read the following, it is an important principle to understand.

### IDs, References, and Instances

In CGP, the **URL is the identity**. When one part of the graph refers to another, it holds the target's URL — there are no separate "ID" values distinct from addresses. ID, reference, and address are the same concept, looked at from different directions.

- An **ID** is a URL — the permanent address of a node.
- A **reference** is a URL placed inside another node's facet (for example, a claim's `channel` column holds the URL of an event definition).
- An **instance** is what `/data` returns when the URL is dereferenced — the content at that identity.

These aren't three different things with a mapping between them. They're one thing (the URL) described from three perspectives: *what you write down*, *what you point at*, *what you receive*. The URL is always the same URL; only the direction changes.

This is why the `/data` facet exists: it is the **instance accessor**. Asking "what is at this URL?" is the same as asking "what is this URL's `/data`?" The other three facets (`/meaning`, `/structure`, `/context`) describe how to interpret the instance.

### Examples:

```
cgp:/s/<system>/o/<observatron>/c/<channel-name>/<event-n>/a/<anchor>/p/<path>
```

```
cgp:/s/0
  instance: "0" (or whatever the system is named)

cgp:/s/0/o/1
  instance: "1" (or whatever the observatron is named)

cgp:/s/0/o/1/c/state-change/4
  instance: summary of the 5th state-change event

cgp:/s/0/o/1/c/state-change/4/a/0
  instance: the anchor's payload (e.g., a CSV file's contents)

cgp:/s/0/o/1/c/state-change/4/a/0/p/0
  instance: the column's values (the leaf payload)
```
#### Event Position and Time

The `<event-n>` counter in a URL is the event's **position** in its channel's sequence. The event's **time** is recorded separately — as the first row's timestamp in that event's `/context` facet.

These are two projections of the same event along different axes:

- The URL names **which** event (the 5th state-change).
- The Context log names **when** it happened (ISO 8601 UTC ms).

Position is structural; time is recorded. Clock skew between implementations doesn't affect `<event-n>` — the counter is local and deterministic, so two implementations that both fire three state-change events produce the same URLs regardless of whether their clocks agree. Replaying a claim log on a new system reconstructs URLs identically; only the Context timestamps differ.

This is why URLs don't carry timestamps directly. Position is the URL's job; time is Context's job. Each dimension lives in the place it naturally belongs, and the connection between them is derivable — dereference the URL, read the first Context row, get the time.

## Step 1 — See Dark Uncertainty (The Four Facet Model)

Every addressable unit in any system — a CSV column, a system prompt workflow on the backend, a UX field — gets four facets:

- **Data** — The content wrapped by **Context Graph Protocol Language** (*CGPL*) markup and captured at an interaction event.
- **Meaning** — The semantic domain the data refers to: what it *is about* in the world, not what it *is* on the page.
- **Structure** — The constraints, generators, and validators of a schema (JSON Schema syntax is default).
- **Context** — A time-ordered log of what has happened at this unit. Each facet is a columnar store: `timestamp`, `channel`, `key`, and `value` are four parallel arrays of equal length. Row N of the log is element N of each array. Rule firings, asks, resolutions, state changes — all in the same shape.

Same four facets everywhere. That uniformity is the geometry. Once it's in place, the invisible becomes addressable with a URL. Before we can do anything, we need to be able to measure it. Without a shared geometry, there's no shared "perspective lines" to make comparisons at all.


### Facet Storage Is Columnar

Each facet is a struct of arrays: column names at the top level, parallel 
arrays as values.

    "/structure": {
      "constraint-key":   ["kind",   "format"],
      "constraint-value": ["system", "csv"]
    }

Row N of the facet is element N of every column. **Invariant:** all arrays 
inside one facet have equal length.

An empty facet declares its schema with empty arrays:

    "/context": { "timestamp": [], "channel": [], "key": [], "value": [] }

Append a row by pushing one element onto every column in lockstep. The 
runtime's `appendContext` helper enforces the invariant; direct mutation 
outside the helper is a bug.


## Step 2 — Score Dark Uncertainty in Real-Time (δ → "Dark Fraction Score")

From a philosophical perspective, the geometry and the protocol are identical, and Unicode expression of math as the highest abstraction and precision layer is canonical.

With shared geometry, we can compute dark fraction:

<p align="center">
δ = 1 − |Bᵣ| / 2ⁿ
</p>

Data is part of the Shannon "message" — the communicated information in a transmission event. Its presence is what brings the spike into existence; a spike that isn't attached to the observatron's surface doesn't exist. Each spike is still a full tetrahedron geometrically, with Data as the base anchoring it to the node and Meaning, Structure, and Context rising as the three elevated faces. Uncertainty can only accumulate along those three elevated dimensions.

For a boundary with m variables, the formula operates on n = 3m verifiable facets — three per variable (Meaning, Structure, Context). r is how many of those facets have been verified. |B_r| is the Hamming ball cardinality. 2ⁿ is the joint configuration space.

### Calculating δ by Hand — The Simplest Case (m=1, n=3)

Before the three-variable example, work through the simplest possible boundary: one column, fully unverified. This walks the formula step by step — the kind of thing you could compute on a napkin.

**Setup.** A CSV drop with one column: `Date`. No facets have been verified yet. So m = 1, n = 3m = 3, r = 0.

**Step 1 — Find the joint configuration space: 2ⁿ.**

With n = 3 verifiable facets, each facet is either verified (1) or not (0). That gives:

| n | 2ⁿ | meaning |
|---|---|---|
| 3 | 8 | 8 possible configurations of (Meaning, Structure, Context) |

The boundary lives somewhere in this space of 8 configurations. δ measures how much of that space is still unreachable.

**Step 2 — Count the Hamming ball |B_r|.**

The Hamming ball of radius r is the set of configurations reachable within r verifications of the fully-verified state. Count it by summing binomial coefficients:

$$|B_r| = \sum_{k=0}^{r} \binom{n}{k}$$

For our case (n=3, r=0), only one term matters:

| k | C(n, k) | meaning |
|---|---|---|
| 0 | C(3, 0) = 1 | one configuration: the fully-verified state itself |

So |B_0| = 1.

**Step 3 — Plug into the formula.**

$$\delta = 1 - \frac{|B_r|}{2^n} = 1 - \frac{1}{8} = 0.875$$

**δ = 87.5%.** A one-column boundary with no facets verified is 87.5% dark.

That matches the Quick Start's claim that dropping a one-column CSV yields δ ≈ 0.875 at drop time.

**Step 4 — Watch it change as you verify.**

Verify one facet — say, Meaning — and r becomes 1. Now:

- |B_1| = C(3,0) + C(3,1) = 1 + 3 = 4
- δ = 1 − 4/8 = 0.5 (50% dark)

Verify Structure too, and r = 2:

- |B_2| = C(3,0) + C(3,1) + C(3,2) = 1 + 3 + 3 = 7
- δ = 1 − 7/8 = 0.125 (12.5% dark)

Verify Context — r = 3, all facets populated:

- |B_3| = 1 + 3 + 3 + 1 = 8
- δ = 1 − 8/8 = 0 (0% dark)

| Facets verified (r) | \|B_r\| | δ = 1 − \|B_r\|/8 | Approximation |
|---|---|---|---|
| 0 | 1 | 1 − 1/8 | 87.5% dark |
| 1 | 4 | 1 − 4/8 | 50% dark |
| 2 | 7 | 1 − 7/8 | 12.5% dark |
| 3 | 8 | 0 | 0% dark |

Three verifications move δ from 87.5% down to 0 in discrete, measurable jumps. No ambiguity. No calibration needed. Verification, count, recompute.

Now scale up: with three columns (m=3), you have n=9 verifiable facets instead of 3, and 2⁹ = 512 configurations instead of 8. The arithmetic gets bigger, but the procedure is identical.

Worked example — *δ = 74.61%*. A CSV drop with three variables: Date, Oil Price, Location. Only Date has been fully verified (all 3 of its facets populated); Oil Price and Location are untouched. So m = 3, n = 9, r = 3. The Hamming ball |B_3| = C(9,0) + C(9,1) + C(9,2) + C(9,3) = 1 + 9 + 36 + 84 = 130. That gives δ = 1 − 130/512 = 0.7461 (74.61%).

**The system is operating somewhere in a space of 512 possible configurations but can only confirm 130 of them. 74.61% of the boundary's interpretation space is unreachable by any within-boundary diagnostic.**

Closing each facet gap is a specific, countable action. Manual reduction becomes a measurable benchmark — the progression table below shows how δ moves as verifications accumulate.

### Symbol Legend

| Symbol | Name | Description |
|---|---|---|
| `δ` | dark fraction | The computed score. Fraction of the joint configuration space still unresolved. Ranges from 0 (fully verified) to nearly 1 (fully dark). Unitless. |
| `m` | variable count | Number of variables at the boundary — columns in a dataset, fields in a form, slots in a query. |
| `n` | facet count | Total verifiable facets, always **3m**. Three facets per variable: Meaning, Structure, Context. Data anchors the spike but is not verifiable in the score. |
| `r` | verified count | How many of the n facets have been populated with a verification value. Moves from 0 to n as reduction happens. |
| `B_r` | Hamming ball of radius r | The set of configurations reachable within r verifications of the fully-verified state. |
| `\|B_r\|` | cardinality of B_r | Count of configurations in the Hamming ball. Computed as Σ C(n, k) for k = 0..r. |
| `2ⁿ` | joint configuration space (\|Ω\|) | All possible configurations across the n verifiable facets. For m=3, n=9 and 2⁹ = 512. |


### Facet Population Progression (m=3, n=9)

For a three-variable boundary, δ moves through these values as facets are verified. Open the **Dark Fraction Calculator** and toggle facets to watch this progression live:

| Facets verified (r) | \|B_r\| | δ = 1 − \|B_r\|/512 | Approximation |
|---|---|---|---|
| 0 | 1 | 1 − 1/512 | ~99.8% dark |
| 1 | 10 | 1 − 10/512 | ~98.0% dark |
| 2 | 46 | 1 − 46/512 | ~91.0% dark |
| 3 | 130 | 1 − 130/512 | ~74.6% dark |
| 4 | 256 | 1 − 256/512 | ~50.0% dark |
| 5 | 382 | 1 − 382/512 | ~25.4% dark |
| 6 | 466 | 1 − 466/512 | ~9.0% dark |
| 7 | 502 | 1 − 502/512 | ~2.0% dark |
| 8 | 511 | 1 − 511/512 | ~0.2% dark |
| 9 | 512 | 0 | 0% dark |

Notice the S-curve. The first verifications barely move δ — the unverified space is combinatorially enormous. The middle verifications drop δ sharply. The final verifications finish the collapse. Verification effort pays off most in the middle of the reduction loop.

### Source of Truth
The Dark Fraction Calculator is the canonical reference implementation of this formula. Any claim in this spec about what δ should be for a given (m, r) pair can be verified by setting up that configuration in the calculator. The calculator handles large-m computation via log-space arithmetic; for m > 20, |Ω| exceeds a million configurations and naive integer math breaks. Implementations should follow the calculator's log-space approach when scaling.



## Step 3 — Minimize Dark Uncertainty with Observatrons

Observatrons can mechanize a specific task: *populate this facet given these inputs*. That's an engineering problem with a definition of done — not a vague "reduce uncertainty" goal. An **observatron** is the unit that performs this work: an autonomous state machine stationed at a boundary, watching what crosses, and resolving facets either deterministically or by asking a human.

![Two observatrons across a boundary. Each is a spiky ball — the node surface with tetrahedral spikes sticking out. Each spike has its Data face pressed against the surface (anchoring it) and its Meaning, Structure, and Context faces elevated. Color encodes dark uncertainty: redder means higher δ, more verified means more glowing surface. The cable between them is an emission crossing a boundary. Observatron-1 is 80.2% dark across 20 columns; Observatron-2 is 58.9% dark across 17 columns.](figures/two-observatrons.png)

In our **Getting Started** example, we will focus on Observatrons across the entire stack — minimal, but end-to-end:

- **UX**: The drag & drop area in HTML
- **API**: Back-end service layer
- **SQL**: Intent mapping to query slots


## The Context Graph Protocol - Overview
The **Context Graph Protocol** is a syntax that layers over any other syntax — HTML, system prompts, CSV, JSON, SQL, plain text — to bind addressable units across systems to a shared four-facet geometry.

Of the four facets introduced in Step 1, each plays a distinct role:

- **Data** is the Shannon message — the communicated information in a transmission event. It anchors the spike to the observatron's surface.
- **Meaning** and **Structure** describe the message statically — what it refers to and how it's encoded.
- **Context** is different: it's a time-ordered log where external actions leave their trace on the node. If Meaning and Structure describe the message, Context records its collisions with the world. The graph grows by collision.

Because the graph's shape adapts as actions flow through it, we call it Liquid — the protocol's substrate moves between hosts and media without losing identity, taking whichever shape its container demands.

### Try It Yourself — Dark Fraction Calculator

Before diving into code, play with the geometry directly. The **Dark Fraction Calculator** lets you toggle facets on a single field and watch δ change in real time.

![Dark Fraction Calculator](figures/dark_fraction_calculator.png)

<a href="https://w3c-context-graph-community-group.github.io/dark_fraction/calculator/" target="_blank" rel="noopener noreferrer">→ Open the Dark Fraction Calculator</a>

Click **M** to populate Meaning, **S** for Structure, and **C** for Context. Each click closes one facet gap and reduces the dark fraction. Start with everything off and close facets one at a time until you reach δ = 0. That's the full manual reduction loop in about four clicks.

This is the core interaction the protocol enables. Everything in the rest of this guide — wrappers, URL structure, the runtime, the demo — is machinery to surface this same loop across real systems.

## Quick Start

The fastest path from zero to a working CGP observation. Wrap a DOM element, drop a CSV onto it, watch the four-facet graph materialize in real time.

### Creating a Four Facet Model for Different Content

#### Example: a URL encoded as FFM

Here's `cgp:/s/0` — the system node — encoded as a four-facet model:

    {
      "/data": {
        "anchor": ["cgp:/s/0"]
      },
      "/meaning": {
        "symbol":  ["cgp:/s/0"],
        "meaning": ["user system"]
      },
      "/structure": {
        "constraint-key":   ["kind"],
        "constraint-value": ["system"]
      },
      "/context": {
        "timestamp": ["2026-04-24T18:30:00.123Z"],
        "channel":   ["system-instantiated"],
        "key":       ["systemId"],
        "value":     ["0"]
      }
    }

**The anchor rule.** `/data` has one column (`anchor`) with exactly one 
row. That single row is the act of selection: out of everything you 
could have pointed at — ten URLs, ten datasets, ten files in a dropped 
folder — you pointed at *this one*.

That choice is what makes the other three facets possible. `/meaning`, 
`/structure`, and `/context` are facets **of the anchor**. They describe, 
constrain, and log the history of the thing `/data` points to. Change 
the anchor and you change what they're about. Two anchors in one `/data` 
would mean the other three facets are simultaneously describing two 
different referents — and then nothing they say is unambiguous.

The other three facets have no row limit. `/meaning` can carry many 
symbol→meaning pairs about the anchor. `/structure` can stack 
constraints. `/context` grows as events accumulate. Only `/data` is 
pinned to one row, because only `/data` answers *which thing are we 
talking about*.

#### Install

```bash
npm install cgp-runtime cgp-components
```

#### Wrap an element

Import the component once at the top of your page, then wrap any element you want to observe with a `<cgp-drag-and-drop>` tag:

```html
<script type="module">
  import "cgp-components/drag-and-drop";
</script>

<cgp-drag-and-drop system-id="0" observatron-id="1">
  <div class="drop-target">Drop a CSV here</div>
</cgp-drag-and-drop>
```

The tag takes two attributes:
- `system-id` — any URL-safe string; your system's identifier
- `observatron-id` — any URL-safe string; this observatron's identifier within the system

The wrapper is transparent. The inner `<div>` remains the drop target. On page load, the wrapper instantiates an observatron and mints two nodes: `cgp:/s/0` (the system) and `cgp:/s/0/o/1` (the observatron), each with their four facets populated.

#### Listen for state changes

Every observation dispatches a `cgp-state-change` CustomEvent. Listen anywhere on the page:

```html
<script>
  document.addEventListener("cgp-state-change", (event) => {
    console.log(event.detail.state);
  });
</script>
```

The `event.detail.state` is a flat object keyed by URL, with each URL's four facets as its value.


## CGP URL Schema

Every CGP URL follows a single positional pattern. Each segment is prefixed by a single letter naming the slot; the value after the letter identifies the instance.

```
cgp:/s/<system>/o/<observatron>/c/<channel-name>/<event-n>/a/<anchor>/p/<path>
```

### Slots

| Slot | Prefix | What it addresses |
|---|---|---|
| system | `s` | Unit of scope. Instantiates observatrons. |
| observatron | `o` | Agent stationed at a boundary. The node. |
| channel + event | `c` | Compound slot. The channel name identifies the kind of event (referencing a definition under `cgp:/root/events/`); the event counter follows, auto-incrementing per channel, per observatron. Written as `c/<channel-name>/<event-n>`. |
| anchor | `a` | One anchor produced by an event — one file, one message, one API payload. The base of a set of spikes. |
| path | `p` | One spike — a column, a field, a JSON Pointer target within the anchor. |

### IDs

**System and observatron IDs are user-supplied** — typically integers, but any URL-safe string works.

**Channel names** come from the reserved registry `cgp:/root/events/`. The segment is the leaf name of that URL (e.g., `state-change`).

**Event, anchor, and path IDs are auto-generated integers starting at 0**, scoped to their parent. Counters reset per parent: each channel numbers its events from `0` within one observatron; each event numbers its anchors from `0`; each anchor numbers its paths from `0`.

### Facets

Every URL has four facets, written as terminal path segments:

```
<url>/data        the instance at this identity
<url>/meaning     what it refers to
<url>/structure   how it is encoded
<url>/context     a time-ordered log of what has happened
```

All four apply at every slot depth. `cgp:/s/0/data` is valid. So is `cgp:/s/0/o/1/c/state-change/4/a/0/p/0/data`.

Every /context facet is a four-column columnar store — `timestamp`, `channel`, `key`, and `value` are four parallel arrays of equal length, appended in lockstep. Row N of the log is element N of each array. Context is the collision surface: where actions, events, and timestamped interactions leave their trace on a node.

### Truncation

Any prefix of the slot pattern is a node. Each has its own four facets.

```
cgp:/s/0                                       the system
cgp:/s/0/o/1                                   an observatron
cgp:/s/0/o/1/c/state-change/4                  an event in a channel
cgp:/s/0/o/1/c/state-change/4/a/0              an anchor
cgp:/s/0/o/1/c/state-change/4/a/0/p/0          a spike (path)
```

### Reserved

The system id `root` is reserved for the protocol's own self-description. All other IDs — including `0`, `1`, `2`, … — are available to user systems.

Reserved namespaces under `cgp:/root`:

| Segment | Purpose |
|---|---|
| `cgp:/root/events` | Registry of channel definitions. Each channel lives at `cgp:/root/events/<source>/<name>` with the standard four facets. The leaf name is what appears as `<channel-name>` in observation URLs. |
| `cgp:/root/claims` | Reserved for future claim log storage. |

## The Canonical Claim Form

A **claim** is a single assertion: at a specific time, a specific node said something about something. Claims are how CGP graphs are exchanged between systems and how the graph's history is made portable.

Claims are a **view** over the URL-addressed facet store — projected when needed, not stored as the authoritative form. A running implementation reads and writes facets directly; claims are generated for export, comparison, and audit.

### The Five Columns

Every claim has exactly five columns. Each is either a URL (acting as ID, reference, and address simultaneously — see "IDs, References, and Instances" above) or a literal.

| Column | Holds | Example |
|---|---|---|
| `channel` | URL of the channel definition — the kind of claim. | `cgp:/root/events/observatron/state-change` |
| `source` | URL of the node that produced the claim. | `cgp:/s/0/o/1/c/state-change/4` |
| `timestamp` | When the claim was made. ISO 8601 UTC, millisecond precision. | `2026-04-22T22:30:00.003Z` |
| `key` | Path within the facet being asserted about. | `/properties.event.type` |
| `value` | The asserted value. A literal or a URL. | `"trade execution date"` |

Read a claim left-to-right as a sentence: *at `timestamp`, `source` asserted that the facet at `key` has `value`, as a claim of kind `channel`*.

### Identity Is Positional

When claims are stored as an ordered array, the position in the array is the claim's identity. No `id` column is needed — index N is claim N.

Individual claims become URL-addressable when they need to be referenced: claim N in a channel's log is addressable under `cgp:/s/<s>/o/<o>/c/<channel>/<event-n>`. The URL is constructed on demand from the log's location and the claim's position; it does not live inside the claim itself.


**Claim Tuple (TIME, CHANNEL, SOURCE, KEY, VALUE)**

- **CHANNEL**: what kind of transmission it was (URL of the event definition)
- **SOURCE**: who transmitted it (URL of the emitting node)
- **TIME**: when the transmission happened (Context timestamp, or the ordinal event-n if you only need ordering)
- **KEY**: where in the payload (path within the facet)
- **VALUE**: what was asserted at that position

All five are addressable, all five compose into claims, all five can be compared across observatrons, systems, and time. Because the URL structure carries the first three (CHANNEL, SOURCE, and — via event-n — TIME ordering), only KEY and VALUE live in the claim's row; the rest are derivable from the URL the claim lives at.

The compression isn't a performance optimization. It's the mechanism by which **two independent systems can compare what they saw without sharing any prior schema**. Each system produces URLs that carry their own context. A reader of either system's graph can walk URLs alone to reconstruct most of the picture, dereference `/context` for time, dereference `/data` for values, and compare projections. No lookup table, no translation layer, no schema negotiation.

That's the payoff. Three compressions in the structure, and the output is a protocol where comparability is structural rather than agreed-upon.

## In Progress

### 1. Runtime API Contract

```javascript
// UrlManager — the only class that constructs URL strings
class UrlManager {
  constructor() {
    this.counters = new Map();  // keyed by parent URL → next integer
  }

  mintSystem(id) {
    return `cgp:/s/${id}`;
  }

  mintObservatron(systemUrl, id) {
    return `${systemUrl}/o/${id}`;
  }

  // Auto-incremented per (observatron, channel) pair
  mintEvent(observatronUrl, channelName) {
    const key = `${observatronUrl}/c/${channelName}`;
    const n = this.counters.get(key) ?? 0;
    this.counters.set(key, n + 1);
    return `${observatronUrl}/c/${channelName}/${n}`;
  }

  // Auto-incremented per event
  mintAnchor(eventUrl) {
    const n = this.counters.get(eventUrl) ?? 0;
    this.counters.set(eventUrl, n + 1);
    return `${eventUrl}/a/${n}`;
  }

  // Auto-incremented per anchor
  mintPath(anchorUrl) {
    const n = this.counters.get(anchorUrl) ?? 0;
    this.counters.set(anchorUrl, n + 1);
    return `${anchorUrl}/p/${n}`;
  }
}

// createObservatron — factory returning an observatron instance
function createObservatron({ systemId, observatronId, urlManager }) {
  // Returns an object with:
  //   systemUrl:       string — cgp:/s/{systemId}
  //   observatronUrl:  string — cgp:/s/{systemId}/o/{observatronId}
  //   mintEvent({ channel }) → string (the event URL)
  //   mintAnchor({ eventUrl, filename, content, bytes, rows }) → string (the anchor URL)
  //   mintPath({ anchorUrl, header, values, columnIndex }) → string (the path URL)
  //   appendContext({ url, channel, key, value }) → void — pushes one element onto each of the four column arrays (timestamp, channel, key,  value) of the node's /context facet. timestamp is stamped by the runtime at append time. The four arrays must remain equal in length; this helper enforces that invariant.
  //   getState() → deep clone of the flat facet store
  //   dispatchStateChange() → fires 'cgp-state-change' with { event, state }
  //
  // On construction, writes facets for the system and observatron nodes.
  // System's /context gets one row: channel='system-instantiated'.
  // Observatron's /context gets one row: channel='observatron-bound'.
}
```


Scope: The facet store lives on the observatron instance (returned as part of getState()), not globally. One observatron = one store. Multiple observatrons on a page each have their own.
Why one UrlManager instance per observatron. Counters are scoped per observatron anyway (event-n is per-channel-per-observatron), so there's no benefit to sharing a UrlManager. Keeping it instance-level means tests can be isolated.

### 2. Event Definition File Structure
File location: /events/state-change.json (at the repo root, one subdirectory for the reserved events registry).
File contents:

```json
{
  "url": "cgp:/root/events/observatron/state-change",
  "facets": {
    "/data": {
      "anchor": ["cgp:/root/events/observatron/state-change"]
    },
    "/meaning": {
      "symbol": ["cgp:/root/events/observatron/state-change"],
      "meaning": ["Fired by an observatron whenever its state changes. Host bindings dispatch this as the DOM event 'cgp-state-change'. Payload includes the full URL-keyed facet store at the moment of emission."]
    },
    "/structure": {
      "constraint-key": [
        "type",
        "required",
        "properties.event.type",
        "properties.event.const",
        "properties.state.type",
        "properties.state.description"
      ],
      "constraint-value": [
        "object",
        "[event, state]",
        "string",
        "cgp:/root/events/observatron/state-change",
        "object",
        "flat URL-keyed map of facet stores"
      ]
    },
    "/context": {
      "timestamp": [],
      "channel": [],
      "key": [],
      "value": []
    }
  }
}
```

How the runtime uses it. The runtime imports this file at startup (or loads it via fetch). The event URL becomes a hardcoded reference throughout the runtime. When dispatching cgp-state-change, the runtime reads the event URL from this file and includes it in the event payload:

```javascript
import eventDef from './events/state-change.json' with { type: 'json' };
// ...
const customEvent = new CustomEvent('cgp-state-change', {
  bubbles: true,
  detail: {
    event: eventDef.url,  // the registered URL
    state: observatron.getState()
  }
});
```

Why JSON, not JS. Keeps the event definition portable — non-JS implementations (Python, Rust) can read the same file. The four-facet shape is preserved verbatim.

### 3. Drop Handler Minting 


When a user drops files onto the drag-and-drop wrapper, the observatron executes this sequence:


```
1. Mint ONE event under the state-change channel:
   mintEvent({ channel: 'state-change' })
   → cgp:/s/0/o/1/c/state-change/{n}
   
   Write event's four facets. Append to event's /context:
   { channel: 'event-fired', key: 'trigger', value: 'drop' }

2. Sort files alphabetically by filename. For each file:

   2a. Read the file as text.
   
   2b. Mint ONE anchor under the event:
       mintAnchor({ eventUrl, filename, content, bytes, rows })
       → cgp:/s/0/o/1/c/state-change/{n}/a/{m}
       
      Anchor's /data = { anchor: [anchorUrl] }  (self-referential, one row)
      Anchor's /meaning = { symbol: [anchorUrl], meaning: [filename] }
      Anchor's /structure = {
        "constraint-key":   ["kind",   "format", "bytes", "rows"],
        "constraint-value": ["anchor", "csv",    bytes,   rows]
      }
      Anchor's /context = {
        timestamp: [<now>],
        channel:   ["anchor-minted"],
        key:       ["filename"],
        value:     [filename]
      }

   2c. Parse CSV. Split on \n, then on , to get headers and row values.

   2d. For each column in the CSV:
       mintPath({ anchorUrl, header, values, columnIndex })
       → cgp:/s/0/o/1/c/state-change/{n}/a/{m}/p/{k}
       
       Path's /data = { anchor: [pathUrl] }
       Path's /meaning = { symbol: [pathUrl], meaning: [header] }
       Path's /structure = {
        "constraint-key":   ["type",   "columnIndex"],
        "constraint-value": ["string", k]
       }
       Path's /context = {
        timestamp: [<now>],
        channel:   ["path-minted"],
        key:       ["header"],
        value:     [header]
      }

3. After all minting completes, dispatch cgp-state-change:
   dispatchStateChange()
   → fires CustomEvent with event.detail = { event: eventUrl, state: getState() }
```

*Edge cases with specified behavior:*

- Zero files dropped: No minting. No event dispatched. (Drop target may glow briefly via CSS; that's a UX concern, not a runtime concern.)
- Zero columns in a CSV: Mint the anchor. Mint no paths. Event still fires.
- Zero rows in a CSV (only a header row): Mint the anchor and one path per header. Each path's `/data` is `{ anchor: [pathUrl] }` as usual
- Multiple files dropped at once: ONE event. Multiple anchors (one per file). Paths under each anchor. One cgp-state-change dispatch at the end.

**Why one event per drop. The drop is a single user gesture — one "state change" event to the host. Each file is a distinct anchor under that event. This preserves the "event = one boundary-crossing" semantics.**

### 4. Drop Target Resolution

The `<cgp-drag-and-drop>` element resolves its drop target via the
`cgp-target` attribute, which holds a CSS selector scoped to the wrapper.

**Example usage:**

```html
<cgp-drag-and-drop system-id="0" observatron-id="1" cgp-target=".drop-target">
  <div class="drop-target">Drop a CSV here</div>
  <div class="preview">Last drop: —</div>
</cgp-drag-and-drop>
```

**Resolution rules:**

1. **Attribute present, selector matches one element:** Use that element as the drop target.
2. **Attribute present, selector matches multiple elements:** Use the first match. Log a console warning.
3. **Attribute present, selector matches zero elements:** Throw an error at `connectedCallback` time.
4. **Attribute missing:** Fall back to `this.querySelector(":scope > *:first-child")` for backward compatibility with the Quick Start.
5. **Attribute present but empty (`cgp-target=""`):** Throw an error.

**Lifecycle:**

- Resolution happens in `connectedCallback`, once per mount.
- If the targeted element is later removed from the DOM, the wrapper does not re-resolve.
- The resolved element's reference is stored on the instance for use by the drop handler.

**Implementation note:** The attribute name is hyphenated (`cgp-target`, not `cgpTarget`), matching Web Components convention and the existing `system-id` / `observatron-id` attributes. Read it via `this.getAttribute('cgp-target')`.

### 5. Directory Structure and Module Loading

**File layout for the MVP:**

```
/
├── index.html              — the demo page
├── cgp-runtime.js          — UrlManager + createObservatron
├── cgp-drag-and-drop.js    — the Custom Element
├── events/
│   └── state-change.json   — event definition
└── fixtures/
    └── sales.csv           — test fixture
```

Everything lives in the repo root or one level deep. No `/lib/`, no `/src/`, no build step. Files are served directly by a static server (`python -m http.server`, `npx serve`, etc.) and imported via relative paths.

**Module loading:**

The Quick Start section above uses npm-style import paths (`"cgp-components/drag-and-drop"`) for illustrative purposes — that's what a published package would look like. For the MVP build, all files are local and imported via relative paths:

```html
<script type="module" src="./cgp-runtime.js"></script>
<script type="module" src="./cgp-drag-and-drop.js"></script>
```

The event definition JSON is loaded via fetch at runtime, not statically imported, to keep the runtime portable across modules that don't support JSON imports:

```javascript
const eventDef = await fetch('./events/state-change.json').then(r => r.json());
```

No TypeScript. No bundler. No package manager. Plain ES modules served by a static server.


### 6. Test Fixture

Location: `/fixtures/sales.csv`

Contents (exact, byte-for-byte):

```csv
Date,Oil Price,Location
2026-01-15,72.45,Houston
2026-01-16,73.12,Rotterdam
2026-01-17,71.89,Singapore
```

Three columns, three data rows. Matches the three-variable example used in Step 2's worked calculation (m=3, n=9, 2⁹ = 512 configurations). Dropping this file produces a boundary the reader has already seen computed by hand.

The file should be committed to the repo so any developer cloning it can drop the same bytes and produce the same URLs, without having to regenerate test data.


### 7. Acceptance Criteria

The MVP is complete when the following behaviors are observable in the demo page.

**On page load:**

The right panel (state display) shows a JSON object with exactly two entries:

```json
{
  "cgp:/s/0": {
    "/data": { "anchor": ["cgp:/s/0"] },
    "/meaning": {
      "symbol":  ["cgp:/s/0"],
      "meaning": ["user system"]
    },
    "/structure": {
      "constraint-key":   ["kind"],
      "constraint-value": ["system"]
    },
    "/context": {
      "timestamp": ["<ISO-8601-UTC-ms>"],
      "channel":   ["system-instantiated"],
      "key":       ["systemId"],
      "value":     ["0"]
    }
  },
  "cgp:/s/0/o/1": {
    "/data": { "anchor": ["cgp:/s/0/o/1"] },
    "/meaning": {
      "symbol":  ["cgp:/s/0/o/1"],
      "meaning": ["observatron"]
    },
    "/structure": {
      "constraint-key":   ["kind"],
      "constraint-value": ["observatron"]
    },
    "/context": {
      "timestamp": ["<ISO-8601-UTC-ms>"],
      "channel":   ["observatron-bound"],
      "key":       ["observatronId"],
      "value":     ["1"]
    }
  }
}
```

Timestamps are real ISO 8601 UTC millisecond-precision strings (e.g., `2026-04-23T22:30:00.123Z`). No console errors.

**After dropping `fixtures/sales.csv`:**

The state panel shows exactly 7 entries:

1. `cgp:/s/0` — the system (unchanged from page load)
2. `cgp:/s/0/o/1` — the observatron (unchanged)
3. `cgp:/s/0/o/1/c/state-change/0` — the event (new)
4. `cgp:/s/0/o/1/c/state-change/0/a/0` — the anchor, `/meaning` = `sales.csv`
5. `cgp:/s/0/o/1/c/state-change/0/a/0/p/0` — the Date column, `/meaning` = `Date`
6. `cgp:/s/0/o/1/c/state-change/0/a/0/p/1` — the Oil Price column, `/meaning` = `Oil Price`
7. `cgp:/s/0/o/1/c/state-change/0/a/0/p/2` — the Location column, `/meaning` = `Location`

A `cgp-state-change` CustomEvent fires exactly once, with:

```javascript
event.detail = {
  event: "cgp:/root/events/observatron/state-change",
  state: <the full object above>
}
```

**After dropping `fixtures/sales.csv` a second time:**

New entries appear under `cgp:/s/0/o/1/c/state-change/1` (note the counter incremented from 0 to 1). The first drop's entries remain in state. The event counter is per-channel-per-observatron, as specified in the URL Schema section.

Total entries after two drops: 12 (the original 2 + 5 from first drop + 5 from second drop).

**Out of scope for the MVP:**

- Dark fraction computation (δ). The state panel shows the facet store; it does not compute or display δ.
- Claim log materialization. No `cgp:/s/0/o/1/claims/...` URLs are minted.
- Persistence. Page reload clears all state.
- Multiple observatrons on one page.
- Back-end bindings (SQL, API).
- Error recovery for malformed CSVs beyond "empty file = no paths minted."

Any of these can be addressed in subsequent increments. The MVP's job is to make the four-facet graph materialize from a real user gesture, so every subsequent feature has a concrete runtime to build against.

---

## Reference for Implementation


This document defines the core terms of the Context Graph Protocol. 
Every term below has a specific meaning. Do not substitute synonyms, do 
not treat terms as interchangeable, do not pattern-match to common usage 
from other protocols. When in doubt, use the exact term defined here.

---

## The Three Structural Terms

### Node

A **node** is an observatron. Nothing else is a node.

- An observatron is stationed at a boundary (a place where data crosses 
  between systems: a UI, an API, a database edge).
- An observatron has an address: `cgp:/s/<system>/o/<observatron>`.
- "Node" and "observatron" are synonymous. Prefer "observatron" in code 
  identifiers; "node" is fine in prose.

**What is NOT a node:**
- A spike is not a node.
- A facet is not a node.
- A system (`cgp:/s/0`) is a scope, not a node. It instantiates 
  observatrons; it is not itself one.
- A URL deeper than `cgp:/s/<s>/o/<o>` (events, anchors, paths) 
  addresses a **spike**, not a node.

### Spike

A **spike** is a tetrahedron attached to an observatron's surface.

- Every spike has exactly one **anchor** (held in its `/data` facet) 
  that pins it to the observatron.
- Every spike has four **facets**: `/data`, `/meaning`, `/structure`, 
  `/context`.
- Spikes are URL-addressable. Any CGP URL with a `/c/`, `/a/`, or `/p/` 
  segment addresses a spike.
- Geometrically: the anchor is the base of the tetrahedron (pressed flat 
  against the observatron's surface); the other three facets are the 
  three elevated faces rising above it.

Examples of spike URLs:
- `cgp:/s/0/o/1/c/state-change/4` — an event spike
- `cgp:/s/0/o/1/c/state-change/4/a/0` — an anchor spike
- `cgp:/s/0/o/1/c/state-change/4/a/0/p/0` — a path spike (one column of 
  a dropped CSV)

**What is NOT a spike:**
- An observatron is not a spike (it's the node the spikes attach to).
- A facet is not a spike (it's a face of a spike).

### Facet

A **facet** is one of the four faces of a spike.

- The four facets are: `/data`, `/meaning`, `/structure`, `/context`.
- A facet is not independently addressable as a "thing." It is always 
  the `/data` of some spike, the `/meaning` of some spike, etc.
- Writing `cgp:/s/0/o/1/data` is valid syntactically; it means "the 
  /data facet of the observatron-1 spike." The URL still addresses a 
  facet-of-a-spike, not a freestanding entity.

Each facet has a specific internal shape (columnar; see 
`Facet Storage Is Columnar` in the main spec).

---

## The Relationship, Stated Geometrically

An observatron is a ball. Tetrahedral spikes stick out of its surface. 
Each spike has one face (the anchor) pressed flat against the ball, and 
three faces rising away from it.

- Ball = node = observatron
- Spike = the thing sticking out of the ball
- Facet = one face of a spike

You cannot have a spike without a node to attach to. You cannot have a 
facet without a spike to be a face of. The hierarchy is strict:

    observatron (node)
      └── spike (tetrahedron attached to node's surface)
            ├── /data      (the anchor, base of the tetrahedron)
            ├── /meaning   (elevated face)
            ├── /structure (elevated face)
            └── /context   (elevated face)

---

## Common Mistakes to Avoid

### Mistake: calling a facet a "node"

Wrong: *"The /context facet of the node is a time-ordered log."*  
Right: *"The /context facet of the spike is a time-ordered log."*  
Or: *"The /context facet at this URL is a time-ordered log."*

The facet belongs to a spike. The spike attaches to a node. The facet 
does not attach to the node directly.

### Mistake: calling a spike a "node"

Wrong: *"Every URL in CGP addresses a node."*  
Right: *"Every URL in CGP addresses either a node (observatron) or a 
spike (attached to an observatron)."*

Only `cgp:/s/<s>/o/<o>` URLs address nodes. Deeper URLs address spikes.

### Mistake: treating the four facets as peers of a node

Wrong: *"A node has four child objects: data, meaning, structure, 
context."*  
Right: *"A spike has four facets. The spike is attached to a node."*

The four facets are faces of one spike, not four sibling structures 
hanging off a node.

### Mistake: using "node" as a generic word for "URL-addressable thing"

Wrong: *"Every node carries four facets."* (This blurs whether you mean 
observatrons or spikes.)  
Right: Either *"Every observatron carries spikes, and every spike has 
four facets,"* or, if you specifically mean the thing-at-a-URL, 
*"Every URL addresses either a node or a spike, each of which has four 
facets."*

"Node" is a specific term for observatron. Do not widen it.

---

## Quick Reference for Code

When writing code, use these identifier conventions:

| Concept | Prefer | Avoid |
|---|---|---|
| An observatron instance | `observatron`, `obs` | `node` (ambiguous in code) |
| A URL addressing an observatron | `observatronUrl` | `nodeUrl` |
| A URL addressing a spike | `spikeUrl` or the specific kind: `eventUrl`, `anchorUrl`, `pathUrl` | `nodeUrl` |
| The four faces | `facet`, `facets` | `field`, `property`, `attribute` |
| `/data`'s single row | `anchor` | `root`, `identity` |

When reading URLs, identify what they address:
- `cgp:/s/0` → a system (scope, not a node)
- `cgp:/s/0/o/1` → an **observatron** (a **node**)
- `cgp:/s/0/o/1/c/.../a/.../p/...` → a **spike**

Everything past `/o/<id>` is a spike URL.

---

## One-Line Summary for Context Injection

> In CGP: an **observatron** is a **node**; a **spike** is a tetrahedron 
> attached to a node, addressable at any CGP URL past `/o/<id>`; a 
> **facet** is one of four faces of a spike (`/data`, `/meaning`, 
> `/structure`, `/context`). Facets are not nodes. Spikes are not 
> nodes. Only observatrons are nodes.








# CGP for Regulated Industries — Audit Trails That Aren't Bolted On

*For product managers in finance, life sciences, healthcare, and other 
regulated sectors.*

---

## The problem every regulated industry is paying for twice

In any regulated industry, two things have to be true about every 
number your systems produce:

1. **It was correct when it was produced.**
2. **You can prove, years later, how it was produced.**

Meeting the first costs you engineering. Meeting the second costs you 
engineering *again* — usually more of it. Audit logs, trace IDs, event 
streams, data lineage tools, replay harnesses, compliance dashboards, 
point-in-time reconstruction systems. A parallel stack, running 
alongside the real system, duplicating its work to make it explainable.

When regulators ask how a trade was priced, how a drug dosage was 
calculated, how a credit decision was made, or how a lab result was 
derived, the answer lives in the second stack — if it was built 
correctly, if it stayed in sync, if the logs weren't truncated, if the 
trace-id was propagated, if the schema didn't drift. Each of those 
"ifs" is a failure mode that has cost real companies real money in 
fines, settlements, and restatements.

**The Context Graph Protocol removes the second stack.** Audit is not a 
layer you add to CGP. Audit is what CGP produces by default, because 
every calculation is already a record of itself.

---

## What "structural audit" means

In CGP, every calculation is stored in the same shape as every other 
piece of data the protocol handles. A formula — say, a risk score, a 
drug interaction check, a claims adjudication rule — isn't code hidden 
inside a service. It's an addressable object in the graph, with four 
facets:

- What it's named and what it's about.
- What its inputs and outputs are.
- **Every step of how it ran, when, with what operands, and what each step produced.**
- A permanent identity (a URL).

When the formula executes, the third item — the stepwise trace — writes 
itself automatically, in the same storage the rest of the system uses. 
There is no separate logging path. There is no "did we remember to log 
this" question.

The consequence: if the calculation happened, the audit exists. If the 
audit is missing, the calculation didn't happen. The two are the same 
record, not two records that have to be kept in sync.

---

## What this gives you, in business terms

### 1. Deterministic replay

"Show me exactly how this number was calculated on this date."

Every step of the calculation is recorded with timestamps, operation 
names, input values, and output values. Anyone with access to the graph 
can rerun the calculation from first principles and get the same answer 
— or discover a discrepancy. No specialized replay harness, no separate 
historical snapshot service.

**Who pays for this today:** trading desks with T+1 settlement 
obligations, clinical trial systems under 21 CFR Part 11, insurance 
claims systems under state regulations, anyone subject to SOX or 
equivalent financial controls.

### 2. Point-in-time reconstruction

"What did the calculation mean back then, not what does it mean now?"

Each operation in a formula (divide, compare, lookup, apply-rate) is 
itself an addressable object with its own definition. If that 
definition changes — a tax rate is updated, a clinical protocol is 
revised, a credit model is retrained — the old version is still 
reachable at its old address. A calculation performed under the old 
definition audits against the old definition, not against whatever is 
current.

**Who pays for this today:** any business where rules change over time 
and historical decisions have to be defensible under the rules that 
existed when they were made. Banking regulation, clinical guidelines, 
tax codes, insurance underwriting, regulatory submissions.

### 3. Diffable executions

"Two systems ran the same calculation and got different answers. Where 
did they diverge?"

Two executions of the same formula produce two traces with the same 
sequence of operations. A line-by-line comparison shows exactly which 
step first produced a different intermediate result. Root cause 
analysis that would take a team days of digging takes minutes.

**Who pays for this today:** reconciliation teams at clearing houses, 
inter-bank settlement, multi-vendor clinical platforms, any system that 
must agree with a counterparty's system.

### 4. Dependency tracing

"Which inputs, upstream, actually influenced this output?"

Every step records which earlier values it consumed. A calculation's 
full provenance — every upstream input that touched the final number — 
is walkable by following references. No separate data lineage tool is 
needed.

**Who pays for this today:** anyone running a data lineage product 
(Collibra, Alation, Informatica EDC, and dozens of bespoke internal 
tools exist specifically to provide a shadow of this).

### 5. Audit of audit

"The auditor reviewed step 3 and certified it. Who reviewed the 
auditor?"

An auditor's certification is itself a record in the graph, attached to 
the specific step they reviewed. A compliance officer's review of the 
auditor is another record, attached to the first. Chains of review, 
attestation, and sign-off compose without a separate workflow system.

**Who pays for this today:** internal audit departments, regulatory 
affairs groups, model validation teams, anyone operating under 
three-lines-of-defense frameworks.

### 6. Cross-system reconciliation with no schema negotiation

"Our vendor calculated it one way. We calculated it another. How do we 
prove who is right without sharing our source code?"

Two independent implementations of the same formula produce traces in 
the same shape. The traces can be compared directly — no integration 
work, no schema mapping, no translation layer. Disagreements are 
mechanically detectable by anyone with both traces.

**Who pays for this today:** bank-counterparty reconciliation, 
sponsor-CRO data exchange in clinical trials, insurance claims 
exchanges, inter-agency regulatory submissions.

---

## Why this is a moat, not a feature

Every existing compliance stack assumes the audit system is separate 
from the production system. SOX programs are built on this assumption. 
21 CFR Part 11 is built on this assumption. GDPR Article 30 records of 
processing are built on this assumption. The entire governance-risk-
compliance software category exists because audit and production are 
separate concerns that must be reconciled.

CGP doesn't compete with those tools by being a better separate audit 
stack. It competes by **removing the separation.** A company running on 
CGP doesn't need a data lineage tool, because lineage is inherent. 
Doesn't need a trace propagation library, because every calculation is 
already traced. Doesn't need a replay harness, because the trace is the 
replay. Doesn't need point-in-time snapshots, because every version of 
every operation is permanently addressable.

This is not an incremental improvement over the current state of the 
art. It is a structural change that eliminates categories of product 
rather than improving them. That is the definition of a moat: not 
"better," but "makes the previous category unnecessary."

---

## What this means for your product

If you work on a product that does any of the following, CGP changes 
the cost structure underneath you:

- Calculates numbers that regulators can ask about
- Produces outputs that customers, counterparties, or partners must 
  reconcile against
- Implements rules that change over time and must be defensible against 
  their historical versions
- Requires any form of review, attestation, or sign-off workflow
- Feeds data into downstream systems where lineage matters

In these environments, your current product is carrying the weight of a 
parallel audit stack whether you see it that way or not. Some of that 
weight is in code you wrote. Some is in vendor contracts. Some is in 
headcount — compliance engineers, audit liaisons, reconciliation teams. 
CGP does not eliminate all of that weight. It eliminates the structural 
*need* for it, which is the precondition for eliminating the rest.

The companies that adopt this shape first will have a defensible cost 
advantage in every regulated market they operate in. Not because their 
audit is nicer to look at — because their audit is free.

---

## What to ask your engineering team

Three questions to sanity-check whether CGP is relevant to your 
product:

1. *How much of our current codebase exists specifically to make other 
   parts of the codebase explainable?* (Logging, tracing, lineage, 
   replay, snapshotting.) If the answer is "more than we'd like to 
   admit," CGP is relevant.

2. *What would we do differently if every calculation were 
   automatically recorded, replayable, and addressable by URL?* If the 
   answer includes "deprecate a vendor," "retire a system," or "reduce 
   a team's scope," CGP is a cost-reduction play, not an experiment.

3. *If a regulator asked us today to prove how a specific output was 
   produced three years ago, how long would that take, and how 
   confident would we be in the answer?* If the honest answer is 
   "weeks, and not very confident," CGP addresses an operational risk 
   you are already carrying.

---

## Summary

Regulated industries pay an ongoing tax to keep audit infrastructure in 
sync with production infrastructure. CGP collapses the two. Every 
calculation records itself in the same shape as the data it operates 
on. Replay, lineage, point-in-time reconstruction, diffing, attestation 
chains, and cross-system reconciliation are consequences of that shape, 
not features built on top of it.

This is the business case. The technical sections of this guide explain 
the mechanism.

### Compression 4 — Operations as Spikes

An operation (divide, compare, lookup, hamming-ball) isn't a primitive 
hidden inside a runtime. It's a spike at a URL, with the same four 
facets as everything else in the graph.

When a formula's `/context` row names `cgp:/root/ops/divide` in its 
channel column, that URL dereferences to a full spike: `/meaning` 
describes what divide means mathematically, `/structure` declares its 
type signature (two numeric operands, one numeric result), and 
`/context` can optionally log every invocation protocol-wide.

This one move — *an operation is a spike* — collapses four systems 
that are normally built separately:

- **Audit** falls out because the formula's `/context` already records 
  every step with timestamps, operands, and results.
- **Type-checking** falls out because each operation's `/structure` is 
  a URL-reachable signature. Walk the channel column, dereference each 
  op, verify operand types match. No separate type system.
- **Validation** falls out because the same walk detects missing 
  operations, undefined operands, and shape mismatches before execution.
- **Documentation** falls out because each operation's `/meaning` is a 
  self-describing definition, reachable by following the same URL that 
  the formula already references.

Four concerns, one structure. The compression isn't that one spike 
shape serves four purposes — it's that the four purposes are the same 
purpose, asked from different directions: *what does this operation do, 
and how do I know?*

The pattern generalizes beyond formulas. Any process whose steps 
reference named kinds — workflows referencing activities, pipelines 
referencing stages, state machines referencing transitions — gets the 
same four systems for free by making the named kinds themselves into 
spikes.

Here's a drop-in section that covers formulas-as-spikes (with the `/context`-is-the-execution-trace move), reification, and the stepwise audit payoff. Written as one coherent section you can paste in as-is and restructure later.

Where it goes: I'd put this right after the **Canonical Claim Form** section and before **In Progress** — it's protocol-level content that belongs with the core spec, not in the implementation appendix. Keeps the dev-facing narrative flowing from "here's what a claim is" → "here's what formulas and reification look like as claims" → "here's the MVP."

```markdown
## Formulas and Reification

The canonical claim form handles two things most protocols treat as 
separate concerns: **formulas** (computation) and **reification** 
(claims about claims). In CGP both fall out of the same structure 
without any special machinery.

### Formulas as Spikes

A formula is a spike at a URL under `cgp:/root/formulas/`. It has the 
same four facets as every other spike in the graph.

For the dark fraction formula — δ = 1 − |Bᵣ| / 2ⁿ — the spike lives at 
`cgp:/root/formulas/dark-fraction` and decomposes like this:

- **`/data`** — the anchor, self-referential (one row, 
  `{ anchor: ["cgp:/root/formulas/dark-fraction"] }`). The formula's 
  identity.
- **`/meaning`** — the mathematical description: what δ means, in 
  Unicode math as the canonical form: `δ = 1 − |Bᵣ| / 2ⁿ`. Readable by 
  a human, parseable by a runtime, language-neutral.
- **`/structure`** — the type signature as JSON Schema constraints: 
  inputs `n` and `r` are integers, output `δ` is a float in [0, 1]. 
  This is what `/structure` is for: static shape of the formula's 
  interface.
- **`/context`** — the execution trace. Each step of the calculation 
  is a row.

The last item is where CGP differs from how most systems handle 
computation. `/context` is already a time-ordered log of events. A 
formula's execution *is* a sequence of time-ordered events 
(operations). The log and the execution are the same thing.

### Unicode Math as Canonical

The formula as a reader would write it on paper is the formula 
CGP stores. Unicode math — `δ = 1 − |Bᵣ| / 2ⁿ` — is language-neutral, 
implementation-neutral, and parseable by any host runtime that wants to 
compile it.

A JavaScript runtime can read the expression, parse it, and realize it 
as a function:

```javascript
document.querySelectorAll('cgp-formula').forEach(el => {
  const name = el.getAttribute('name');
  const expr = el.textContent.trim();
  // parse expr and compile to a function
  // darkFraction = (n, r) => 1 - hammingBall(n, r) / 2**n;
});
```

A Python runtime can do the same with SymPy. A Rust runtime can 
generate a compiled function. Each implementation realizes |Bᵣ| 
however it wants — closed-form, recursive, lookup table — as long as 
the output matches the spec.

**The formula is the spec. Code is one realization of it.** Math 
travels across languages without translation; code doesn't. Declaring 
math as the canonical form means a Polish mathematician, an American 
engineer, and an AI can all read the formula identically.

The one direction CGP does *not* attempt: lifting arbitrary code back 
to math. Code can have side effects, mutation, control flow, closures 
— none of which map to pure math in general. The compilation arrow 
points one way: math → code. If you want provenance between code and 
math, write the math first (in a `<cgp-formula>` tag or spike) and 
derive code from it.

### Execution as `/context`

When the formula runs, each step appends one row to its `/context`. 
The four columns do their normal work:

```json
"/context": {
  "timestamp": [
    "2026-04-24T19:00:00.001Z",
    "2026-04-24T19:00:00.002Z",
    "2026-04-24T19:00:00.003Z",
    "2026-04-24T19:00:00.004Z",
    "2026-04-24T19:00:00.005Z"
  ],
  "channel": [
    "cgp:/root/ops/hamming-ball",
    "cgp:/root/ops/power",
    "cgp:/root/ops/divide",
    "cgp:/root/ops/subtract",
    "cgp:/root/ops/assign"
  ],
  "key": [
    "operands",
    "operands",
    "operands",
    "operands",
    "operands"
  ],
  "value": [
    { "operand-1": "n",     "operand-2": "r",          "result": "|Bᵣ|" },
    { "operand-1": "2",     "operand-2": "n",          "result": "2ⁿ" },
    { "operand-1": "|Bᵣ|",  "operand-2": "2ⁿ",         "result": "ratio" },
    { "operand-1": "1",     "operand-2": "ratio",      "result": "difference" },
    { "operand-1": "δ",     "operand-2": "difference", "result": "δ" }
  ]
}
```

Read row 3 as a sentence: *at 19:00:00.003, the formula invoked 
`divide` with operands |Bᵣ| and 2ⁿ, producing ratio.* That's a 
well-formed claim. The formula executing is the formula emitting 
claims about itself.

Notice what the `channel` column holds: **URLs, not strings**. 
`cgp:/root/ops/divide` is itself a spike, with its own four facets:

- `/meaning`: "arithmetic division over reals"
- `/structure`: input types (two numerics), output type (one numeric)
- `/context`: optional protocol-wide log of every invocation
- `/data`: the op's anchor, self-referential

An auditor dereferences the URL to see exactly what `divide` meant at 
the time it was invoked. If `divide` is later redefined (e.g., to 
change floating-point semantics), the old definition stays reachable 
at its old address and old executions still audit correctly.

### Stepwise Audit, For Free

Because every formula execution writes to `/context` using the 
canonical claim shape, everything you'd normally build a separate 
observability stack for comes out of the protocol by default:

- **Every step is timestamped.** The `timestamp` column already ordered 
  things; now it's also a wall-clock audit record.
- **Every step names which operation ran.** The `channel` column holds 
  the URL of the operation — not an opaque string. An auditor follows 
  the URL to read the operation's definition as it existed at 
  invocation time.
- **Every step records operands and result.** The `key`/`value` columns 
  capture what went in and what came out. Data dependencies between 
  steps are visible.
- **The trace is replayable.** Scan the `channel` column, execute each 
  op, compare each computed result to the recorded result. Any 
  discrepancy is a bug or tamper.
- **The trace is diffable.** Two executions of the same formula produce 
  two `/context` logs with the same channel sequence. `diff` on the 
  value column pinpoints the first step where intermediate results 
  diverged.

### Compound Audit Trails

Formulas compose, and the audit composes with them.

Suppose `dark-fraction` is one input to a bigger formula — say, a risk 
score. The risk score is a spike. Its `/context` logs ops. One of 
those ops might be `cgp:/root/ops/invoke-formula` with value 
`cgp:/root/formulas/dark-fraction`. An auditor following that URL 
lands on the dark-fraction spike's `/context` and sees its five steps. 
Step 1 invokes `hamming-ball`, which is itself a formula whose 
`/context` decomposes further into primitive ops.

**The audit trail is a tree, walkable by dereferencing URLs.** Every 
level of abstraction is addressable. There is no logging framework to 
configure, no trace-id to propagate, no separate observability stack. 
The protocol is the observability stack.

### Reification: Claims About Claims

A claim has a URL. That URL can itself be the subject of another claim. 
When one observatron emits a claim about another observatron's claim, 
the protocol handles it the same way it handles any other claim — 
because the protocol doesn't privilege "original" claims over "claims 
about claims." Every claim is a row in the canonical form with a URL.

This is what RDF calls reification: a statement about a statement. In 
CGP it falls out of the recursion without any special machinery.

An auditor reviewing step 3 of a dark-fraction execution emits a claim 
whose `key` column points at the formula's `/context` row:

```
channel:   cgp:/root/events/audit/step-certified
source:    cgp:/s/0/o/auditor-42
timestamp: 2026-04-25T10:00:00.000Z
key:       cgp:/root/formulas/dark-fraction/context/3
value:     "step reviewed; operands and result verified"
```

Read as a sentence: *at 10:00:00 on 2026-04-25, observatron auditor-42 
asserted that step 3 of dark-fraction's context has been reviewed and 
verified, as a claim of kind step-certified.*

The claim's `key` column holds the URL of another claim's `/context` 
row. That's all reification is. The subject of the certification is 
another claim; the protocol doesn't notice, because a URL is a URL.

The audit record is now itself a first-class spike, addressable and 
reifiable. A compliance officer's review of the auditor is another 
claim whose `key` points at the auditor's certification. Chains of 
review, attestation, and sign-off compose without any workflow system 
— just claims pointing at claims pointing at claims.

### Two Patterns of Graph Growth

From this, two distinct patterns of graph growth emerge. Both use the 
same mechanism (a claim's `key` names what the claim is about); they 
grow the graph in different directions.

**Reification — depth.** One observatron emits a claim. Another 
observatron emits claims about that claim. Layers stack: claims about 
claims about claims. Each layer sits at a different URL from the 
layers below.

**Co-observation — breadth.** Multiple observatrons emit claims about 
the same underlying subject. Claims with the same `(key, channel)` 
pair stack up as parallel observations. Readers walking the graph can 
compare multiple perspectives on the same facet and see where 
observatrons agree or disagree.

The protocol supports both with the same mechanism: a claim's `key` 
names what the claim is about, and observatrons emit whatever claims 
they need. No central coordinator arbitrates. No schema dictates which 
patterns may occur. The graph grows wherever observation actually 
extends — depth, breadth, or both.
```
