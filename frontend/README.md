# Tenura — dashboard

The Tenura workforce-risk dashboard: a React + TypeScript SPA (Vite) built as a calm,
editorial analytical instrument — ink on paper, structured with hairlines, where the
only colour is the risk tier itself. Light and dark (a deep neutral control-room tone)
are both authored, with accessible, interactive charts.

## Two data modes
- **Bundled demo** (default): the app loads the artifacts in `public/data/` and runs
  the real what-if model **in the browser** (`src/scorer.ts`, a faithful replica of
  the served Logistic Regression — verified to match the backend within 1e-4). This
  is how the public GitHub Pages site stays fully interactive with no server.
- **Live API**: set `VITE_API_BASE` to a running backend URL. The app probes
  `/health` and, when reachable, reads employees, predictions and batch scoring from
  the FastAPI service instead.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
```

## Build
```bash
npm run build      # -> dist/ (static)
# For the GitHub Pages project site the base path is /tenura/ (set in vite.config.ts).
# For a custom domain or container, build with VITE_BASE=/ :
VITE_BASE=/ npm run build
```

## Refresh bundled data
After retraining the model, copy the latest artifacts in:
```bash
python ../infra/sync_artifacts.py
```

## Structure
| Path | Role |
|------|------|
| `src/App.tsx` | Shell: sidebar nav, theme toggle, data init |
| `src/Overview.tsx` · `Employees.tsx` · `Drivers.tsx` · `Predict.tsx` · `Batch.tsx` | The five views |
| `src/charts.tsx` | Accessible charts (risk spectrum, magnitude bars, driver bars) with hover tooltips |
| `src/scorer.ts` | In-browser replica of the trained model |
| `src/api.ts` | Data layer — bundled vs. live API, CSV parsing/scoring, chat routing |
| `src/i18n.tsx` | English + Arabic strings, RTL, driver/label/action localization |
| `src/Chat.tsx` · `assistant.ts` | AI assistant UI + grounded in-browser retrieval engine |
| `src/theme.css` | The design system (tokens, hairline surfaces, type scale, RTL logical properties) |

## Internationalisation & RTL
The app is fully bilingual (English / Arabic). The language switch in the header sets
`dir="rtl"` on `<html>` for Arabic; layout uses CSS logical properties so it mirrors
cleanly. Every string — nav, charts, tables, driver names, retention actions and the
assistant — comes from `src/i18n.tsx`; nothing is hard-coded.

## AI assistant
`Chat.tsx` renders the assistant. When a live backend is configured it calls `POST
/chat` (Google Gemini, key server-side only); otherwise it answers from `assistant.ts`,
a deterministic engine grounded in the bundled data. Both reply in the current UI
language and stay strictly in scope.
