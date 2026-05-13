<!-- tasks/intent-matched.md -->

# intent-matched

**Reference URL:** `cgp:/r/tasks/intent-matched.md`

The task of evaluating a payload that crossed an observatron's boundary against the observatron's intent map. One spike is minted per matched trigger, carrying the trigger's handler payload in `/data`.

## Used by

- Any component whose spikes are minted via the intent-map mechanism (e.g. `cgp:/r/components/html/forms/textarea.md`).

## Produces

- One spike per matched trigger, minted when a boundary crossing matches one or more triggers in the intent map.

## Lifecycle

1. The host page declares the component. The observatron is minted under the `cgp:/r/events/activated.md` channel.
2. A payload crosses the watched boundary. The runtime evaluates it against every trigger in the intent map.
3. For each matched trigger, a spike is minted under the `cgp:/r/events/intent-matched.md` channel; its first `/context` row carries this task.
