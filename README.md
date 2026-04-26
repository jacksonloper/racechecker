# racechecker

A lightweight React + TypeScript simulator for exploring optimistic UI race conditions.

## Case study 1

This demo shows two independent browser tabs editing the same debounced text field while a
server uses optimistic concurrency (version checks) to decide whether each POST is accepted or
rejected.

- The left side shows two browser copies of the UI.
- The right side shows authoritative server state plus all in-flight requests and responses.
- `Step time` advances the debounce clock.
- `POST A now` / `POST B now` force a request into flight immediately when a tab is dirty.
- `Queue refresh` creates a synthetic refresh request.
- Each in-flight message can be completed or lost in any order.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```
