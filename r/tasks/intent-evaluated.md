<!-- tasks/intent-evaluated.md -->

# intent-evaluated

**Reference URL:** `cgp:/r/tasks/intent-evaluated.md`

The task of evaluating a payload that crossed an observatron's boundary against the observatron's intent map. One spike is minted per matched trigger.

## Used by

- Any component whose spikes are minted via the intent-map mechanism (e.g. `cgp:/r/components/html/forms/textarea.md`).

## Produces

- One observatron, minted at instantiation
- One spike per matched trigger, minted when a payload crosses the boundary and the runtime evaluates it against the intent map

## Lifecycle

1. The host page declares the component. The observatron is minted; its first `/context` row carries this task.
2. A payload crosses the watched boundary. The runtime evaluates it against every trigger in the intent map. For each match, a spike is minted; its first `/context` row carries this task.
