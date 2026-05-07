<!-- components/html/forms/textarea.md -->

# textarea

**Reference URL:** `cgp:/r/components/html/forms/textarea.md`

An HTML textarea element. When the host page declares it, an observatron is minted under the `cgp:/r/events/activated.md` channel. When the textarea's value crosses the boundary, the runtime evaluates it against the intent map's triggers and mints one spike per matched trigger on the `cgp:/r/events/intent-matched.md` channel, carrying the matched trigger's handler verbatim in `/data`.

## HTML form

```html
<div cgp-id="cgp:/r/components/html/forms/textarea.md"
     cgp-system-id="0"
     cgp-observatron-id="0"
     cgp-target=".textarea"
     cgp-intent="{...}">
  <textarea class="textarea"></textarea>
</div>
```

## Intent map

The `cgp-intent` attribute carries the three-frame intent map. Example with one rule under `program-intent`:

```json
{
  "program-intent": {
    "rules": [
      {
        "rule-id": "pii-detection",
        "triggers": [
          {
            "id": "email-regex",
            "predicate": { "type": "regex", "value": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
            "handler": { "block-submit": true, "message": "PII detected: remove email address before submitting." }
          }
        ]
      }
    ]
  },
  "user-intent": { "rules": [] },
  "business-intent": { "rules": [] }
}
```

## Attributes

| Attribute | Required | Purpose |
|---|---|---|
| `cgp-system-id` | yes | Identifier for the system scope. Supplied by the host. |
| `cgp-observatron-id` | yes | Identifier for the observatron within the system. Supplied by the host. |
| `cgp-target` | yes | CSS selector identifying the inner `<textarea>` element. |
| `cgp-intent` | yes | JSON-encoded three-frame intent map. Recorded verbatim in `/data` per the No-Parsing Rule. Declares which boundary crossings mint spikes and what those spikes carry. |

## On instantiation (observatron minted)

The attribute set crosses the boundary verbatim and becomes the observatron's `/data`. The first two `/context` rows record the task and the component-type under the `cgp:/r/events/activated.md` channel. All four facets are present at minting time per the coupling rule (`/meaning` and `/structure` may have empty rows).

## On boundary crossing (spike minting)

The boundary is the watched `<textarea>` element. When its value crosses the boundary (e.g. on the native `change` event — blur after value changed, or form submit), the runtime evaluates the value against every trigger in the intent map.

Each matched trigger mints exactly one spike on the `cgp:/r/events/intent-matched.md` channel. The spike's `/data.value` carries the matched trigger's handler verbatim. The spike's `/context` records which frame, rule, and trigger produced it.

If no triggers match, no spikes are minted. If multiple triggers match (across any combination of frames), one spike per match.

## Canonical spike shape

A spike minted when the `email-regex` trigger under `program-intent` / `pii-detection` matches the textarea's value:

```json
{
  "/data": {
    "value": { "block-submit": true, "message": "PII detected: remove email address before submitting." }
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
      "2026-05-06T18:30:00.000Z",
      "2026-05-06T18:30:00.000Z",
      "2026-05-06T18:30:00.000Z",
      "2026-05-06T18:30:00.000Z",
      "2026-05-06T18:30:00.000Z"
    ],
    "key": [
      "cgp:/r/keys/task.md",
      "cgp:/r/keys/component-type.md",
      "cgp:/r/keys/frame.md",
      "cgp:/r/keys/rule.md",
      "cgp:/r/keys/trigger.md"
    ],
    "value": [
      "cgp:/r/tasks/intent-evaluated.md",
      "cgp:/r/components/html/forms/textarea.md",
      "program-intent",
      "pii-detection",
      "email-regex"
    ]
  }
}
```

`/data.value` carries the handler object from the matched trigger, recorded verbatim. `/context` rows 0–1 are the standard minting rows (task and component-type). Rows 2–4 record the frame, rule, and trigger that produced this spike — these distinguish what was interpreted, not the channel.
