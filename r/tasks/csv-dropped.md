<!-- tasks/csv-dropped.md -->

# csv-dropped

**Reference URL:** `cgp:/r/tasks/csv-dropped.md`

The task of receiving a CSV file dropped onto the observatron's watched boundary and minting one spike per column.

## Used by

- `cgp:/r/components/html/forms/drag-and-drop.md`

## Produces

- One observatron, minted at instantiation
- One spike per CSV column, minted when the file is dropped

## Lifecycle

1. The host page declares the drag-and-drop component. The observatron is minted; its first `/context` row carries this task.
2. A user drops a CSV file. For each column, a spike is minted; its first `/context` row carries this task.
