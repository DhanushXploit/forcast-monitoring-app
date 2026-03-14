from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
import asyncio

app = FastAPI(title="Wind Forecast Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
TIMEOUT = 60.0


async def fetch_json(client: httpx.AsyncClient, url: str, params: dict) -> list:
    r = await client.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


@app.get("/api/chart-data")
async def get_chart_data(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    horizon_h: float = Query(4.0, ge=0, le=48, description="Forecast horizon in hours"),
):
    """
    Returns actual + forecasted wind generation for a date range.
    Applies forecast horizon filter: only forecasts published at least
    `horizon_h` hours before the target startTime are shown.
    """
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_dt   = datetime.strptime(end_date,   "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    if (end_dt - start_dt).days > 31:
        raise HTTPException(400, "Date range cannot exceed 31 days.")

    # For forecasts, we need publishTimes that could produce targets in our range.
    # A forecast published up to 48h before start_date could cover start_date.
    forecast_pub_from = (start_dt - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")
    forecast_pub_to   = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    async with httpx.AsyncClient() as client:
        actuals_task  = fetch_json(client, f"{BASE}/FUELHH/stream", {
            "settlementDateFrom": start_date,
            "settlementDateTo":   end_date,
            "fuelType": "WIND",
            "format":   "json",
        })
        forecasts_task = fetch_json(client, f"{BASE}/WINDFOR/stream", {
            "publishDateTimeFrom": forecast_pub_from,
            "publishDateTimeTo":   forecast_pub_to,
            "format": "json",
        })
        actuals_raw, forecasts_raw = await asyncio.gather(actuals_task, forecasts_task)

    # ── Process actuals ──────────────────────────────────────────────
    actuals = {}
    for rec in actuals_raw:
        st = rec.get("startTime")
        gen = rec.get("generation")
        if st and gen is not None:
            actuals[st] = float(gen)

    # ── Process forecasts: apply horizon filter ──────────────────────
    # Group forecasts by startTime, keep latest publishTime that satisfies horizon
    forecast_candidates: dict[str, list] = {}
    for rec in forecasts_raw:
        st  = rec.get("startTime")
        pt  = rec.get("publishTime")
        gen = rec.get("generation")
        if not (st and pt and gen is not None):
            continue
        try:
            st_dt = datetime.fromisoformat(st.replace("Z", "+00:00"))
            pt_dt = datetime.fromisoformat(pt.replace("Z", "+00:00"))
        except ValueError:
            continue

        horizon = (st_dt - pt_dt).total_seconds() / 3600
        if horizon < horizon_h:
            continue  # published too late — doesn't satisfy horizon requirement

        # Only include forecasts whose target is in our display range
        if not (start_dt <= st_dt <= end_dt + timedelta(days=1)):
            continue

        if st not in forecast_candidates:
            forecast_candidates[st] = []
        forecast_candidates[st].append({"publishTime": pt_dt, "generation": float(gen)})

    # For each target time, pick the LATEST valid publishTime
    forecasts = {}
    for st, candidates in forecast_candidates.items():
        best = max(candidates, key=lambda x: x["publishTime"])
        forecasts[st] = best["generation"]

    # ── Build chart series ───────────────────────────────────────────
    # Use actual timestamps as the backbone
    all_times = sorted(set(actuals.keys()) | set(forecasts.keys()))

    series = []
    for t in all_times:
        point = {"time": t}
        if t in actuals:
            point["actual"] = actuals[t]
        if t in forecasts:
            point["forecast"] = forecasts[t]
        series.append(point)

    return {
        "series": series,
        "meta": {
            "actual_count":   len(actuals),
            "forecast_count": len(forecasts),
            "horizon_h":      horizon_h,
            "start_date":     start_date,
            "end_date":       end_date,
        }
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}