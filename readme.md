# WindWatch — UK Wind Forecast Monitor

A full-stack forecast monitoring app for UK national wind power generation.
Built for the REint Full Stack SWE challenge.

> **AI Tools Disclosure:** This project was built with assistance from Claude (Anthropic) for code generation and structure. All logic, data analysis, and architecture decisions were verified and directed by the developer.

---

## Project Structure

```
windapp/
├── backend/
│   ├── main.py           # FastAPI backend — fetches & processes Elexon API data
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main React app (chart, controls, stats)
│   │   ├── main.jsx      # Entry point
│   │   └── index.css     # Global styles & CSS variables
│   ├── index.html
│   ├── vite.config.js    # Vite config with /api proxy
│   └── package.json
└── README.md
```

---

## Data Sources

| Dataset | Endpoint | Used For |
|---------|----------|----------|
| FUELHH  | `data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | Actual wind generation (30-min resolution) |
| WINDFOR | `data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` | Forecasted wind generation (1-hr resolution) |

**Date range:** January 2024 recommended (as per challenge spec)
**Forecast horizon filter:** 0–48 hours (configurable via slider)

---

## How to Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

The Vite dev server proxies `/api` → `http://localhost:8000` automatically.

---

## App Features

- **Date range picker** — select any start/end date (up to 31 days)
- **Forecast horizon slider** — 0–48h, filters forecasts published at least N hours before target
- **Dual-line chart** — actual (blue) vs forecast (green dashed) generation in MW/GW
- **Stats bar** — MAE, peak, trough, data point count
- **Responsive** — works on desktop and mobile
- **Tooltip** — shows exact values and delta at each timestamp

---

## Forecast Horizon Logic

For a target time T and horizon H:
- Only forecasts with `publishTime ≤ T − H` are considered
- Among those, the **latest** `publishTime` is selected (most recent valid forecast)
- If no valid forecast exists for a target time, no forecast point is plotted

---

## Deployment

- **Frontend:** Vercel — `vercel --prod` from `/frontend`
- **Backend:** Render / Railway — deploy `/backend` with `uvicorn main:app --host 0.0.0.0 --port $PORT`

App demo: _[link after deployment]_

---

## Analysis Notebooks

| Notebook | Description |
|----------|-------------|
| `analysis/forecast_error_analysis.ipynb` | MAE, median, p99 error; error vs horizon; error by time of day |
| `analysis/wind_reliability_analysis.ipynb` | Historical actual generation; reliable MW recommendation |