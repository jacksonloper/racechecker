# racechecker

Racechecker is a lightweight Vite + React + TypeScript site for interactive security case studies.

## Current case study

- **PKCE authorization-code exchange with Keycloak for a pure SPA**
  - step-by-step forward/back navigation
  - explicit request and response payloads
  - per-actor state panels showing what each participant currently holds
  - cryptographic primitives and guarantees called out at every step
  - explicit emphasis on the absence of an application backend session

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Netlify deployment

This repository includes `/home/runner/work/racechecker/racechecker/netlify.toml` with:

- `npm run build` as the build command
- `dist` as the publish directory
- an SPA redirect rule from `/*` to `/index.html`

## Adding future case studies

1. Add a new case study data file under `/home/runner/work/racechecker/racechecker/src/data` that follows the shared types in `/home/runner/work/racechecker/racechecker/src/types.ts`.
2. Reuse the visualization shell in `/home/runner/work/racechecker/racechecker/src/components/CaseStudyExplorer.tsx`.
3. Add the new case study to the app entry point in `/home/runner/work/racechecker/racechecker/src/App.tsx`.
