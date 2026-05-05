# Context Graph Protocol (CGP)

Reference implementation. Read `r/meta/schema.md` for the protocol spec.

## Run

```bash
npm install
npm start
```

Static files served from repo root on `http://localhost:3000`.
WebSocket bus on `ws://localhost:8080`.

## Layout

- `r/` — addressable references (the protocol's reference catalog)
- `lib/` — runtime libraries (event bus, schema service)
- `components/` — example consumers (UIs that build on CGP)

URLs resolve literally:
- `cgp:/r/<path>` → `r/<path>` on disk
- `cgp:/s/<path>` → runtime state served from the system namespace

See `r/meta/schema.md` for full details.