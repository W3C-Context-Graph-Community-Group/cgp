# textarea intent

**Reference URL:** `cgp:/r/intents/components/html/forms/textarea.md`

Declares the intent map for the textarea component. On keyup, console.log the textarea's value.

## Parallel artifacts

| Tree | Path |
|---|---|
| Intent map (JSON) | `/intents/components/html/forms/textarea.json` |
| Handler (JS) | `/handlers/components/html/forms/textarea.js` |

A reader who finds any one of the three files can derive the other two by substituting the prefix.

## Component

`cgp:/r/components/html/forms/textarea.md`

## Instantiation

```html
<div cgp-id="cgp:/r/components/html/forms/textarea.md"
     cgp-system-id="0"
     cgp-observatron-id="0"
     cgp-target=".textarea"
     cgp-intent="cgp:/r/intents/components/html/forms/textarea.md">
  <textarea class="textarea"></textarea>
</div>
```

The `cgp-intent` attribute holds this URL. The runtime derives the JSON and JS paths by prefix substitution, fetches both, and calls the handler with the intent map and the watched element.
