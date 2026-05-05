<!-- events/csv-dropped.md -->

# csv-dropped

**Reference URL:** `cgp:/r/events/csv-dropped.md`

The channel for CSV file crossings. When a CSV file is dropped onto a drag-and-drop observatron's watched boundary and one spike per column is minted, each spike's first two `/context` rows record this URL as their channel value.

## When fired

- A CSV file is dropped onto the element targeted by a drag-and-drop observatron's `cgp-target` selector.
- The runtime mints one spike per column in the CSV.
- Each spike's minting rows record `cgp:/r/events/csv-dropped.md` as their channel.

## Used by

- Spikes minted by `cgp:/r/components/html/forms/drag-and-drop.md`.

## Payload

None. The channel is a pure signal. The spike's `/data` carries the column values; the minting rows carry task + component-type.

**Validates against:** `cgp:/r/schemas/spike.schema.json`