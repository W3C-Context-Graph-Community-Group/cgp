<!-- components/html/forms/textarea.md -->

# textarea

**Reference URL:** `cgp:/r/components/html/forms/textarea.md`

An HTML textarea element. When the host page declares it, an observatron is minted. When text is entered into the textarea, the observatron mints a spike carrying the textarea's value.

## HTML form

```html
<div cgp-id="cgp:/r/components/html/forms/textarea.md"
     cgp-system-id="0"
     cgp-observatron-id="0"
     cgp-target=".textarea"
     cgp-intent="{}">
  <textarea class="textarea"></textarea>
</div>
```

## Attributes

| Attribute | Required | Purpose |
|---|---|---|
| `cgp-system-id` | yes | Identifier for the system scope (auto-assigned if absent). |
| `cgp-observatron-id` | yes | Identifier for the observatron within the system (auto-assigned if absent). |
| `cgp-target` | yes | CSS selector identifying the inner textarea element. |
| `cgp-intent` | yes | JSON-encoded intent map describing what the observatron watches for and how. Recorded verbatim in `/data` per the No-Parsing Rule. |

## On instantiation

- The attribute set crosses the boundary verbatim and becomes the observatron's `/data`.
- The observatron's first `/context` row records the task and component-type (`cgp:/r/components/html/forms/textarea.md`) under the `cgp:/r/events/activated.md` channel.

## On input

- When text is entered, a spike is minted under the observatron.
- The spike's `/data` carries the textarea's value, recorded verbatim as a string.
