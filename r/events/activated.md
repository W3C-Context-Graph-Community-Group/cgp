<!-- events/activated.md -->

# activated

**Reference URL:** `cgp:/r/events/activated.md`

The channel for observatron instantiation. When a CGP element is stamped onto the DOM and its observatron is minted, the minting `/context` rows carry this URL as their channel value.

## When fired

- An HTML element with `cgp-id` enters the DOM.
- The runtime mints an observatron for that element.
- The observatron's first two `/context` rows (task and component-type) record `cgp:/r/events/activated.md` as their channel.

## Used by

- All observatron entries — the activation event is universal across components.

## Payload

None. The channel is a pure signal. The minting rows' `key` and `value` columns carry the only payload (task + component-type).

**Validates against:** `cgp:/r/schemas/observatron.schema.json`