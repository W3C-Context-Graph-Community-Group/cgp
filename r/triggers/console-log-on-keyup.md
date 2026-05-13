<!-- triggers/console-log-on-keyup.md -->

# console-log-on-keyup

**Reference URL:** `cgp:/r/triggers/console-log-on-keyup.md`

A trigger that fires on every `keyup` event on the watched element. Its handler payload instructs the consumer to `console.log` the input value.

Used in the textarea intent (`cgp:/r/intents/components/html/forms/textarea.md`) as the canonical minimal example of an intent-driven boundary observation.

## Predicate

```json
{ "type": "event", "event": "keyup" }
```

## Handler payload

```json
{ "console-log": true }
```
