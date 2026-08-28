# Laundry App Frontend

This is the React client for the Laundry App backend. The folder is scaffolded by domain so new work can be added without mixing API calls, screens, shared UI, and application state.

## What Is Template Code?

Most files under `src/` are starter templates. They establish the intended location, public component name, and backend feature boundary, but they do not yet implement production workflows. A template is significant because it is the agreed starting contract for the team: extend it in place, keep its responsibility focused, and connect it to the matching backend route.

The dashboard shell in `src/App.jsx`, its responsive styles, the Axios client, route configuration, constants, and the API starter functions are working foundations. Authentication, forms, tables, charts, detailed pages, and persistence still need real validation, loading states, error handling, permissions, and tests.

## Structure

- `src/api/`: Axios modules matching backend route groups under `/api/v1`.
- `src/auth/`: Login flows, auth context, and protected-route behavior.
- `src/components/`: Reusable navigation, forms, tables, charts, and feedback UI.
- `src/constants/`: Shared role and order-status values.
- `src/hooks/`: Reusable stateful behavior and API lifecycle helpers.
- `src/layouts/`: Page chrome for auth, customer, and staff experiences.
- `src/pages/`: Feature screens grouped by backend domain.
- `src/routes/`: URL-to-screen mapping and navigation metadata.
- `src/store/`: Shared client-side state; replace placeholders with the chosen state strategy.
- `src/utils/`: Formatting, browser storage, and API error helpers.
- `src/styles/`: Shared design tokens and global styles.

## Expectations For Contributors

When implementing a feature, start with the corresponding backend route and validator. Add API functions in `src/api/`, screen behavior in the matching `src/pages/` area, reusable pieces in `src/components/`, and route access rules in `src/routes/`. Keep secrets out of source control and use `VITE_API_URL` from `.env`.

Every completed workflow should cover loading, empty, error, success, and unauthorized states. Match backend response shapes instead of inventing client-only contracts, and add tests when behavior or permissions are non-trivial.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

The backend currently mounts routes at `http://localhost:5000/api/v1` by default. Copy `.env.example` to `.env` and adjust `VITE_API_URL` when the backend runs elsewhere.
