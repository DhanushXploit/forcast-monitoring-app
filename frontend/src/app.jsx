import { useState, useEffect, useCallback } from 'react'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'

// ── helpers ──────────────────────────────────────────────────────────
const fmt = (iso) => {
    try { return format(parseISO(iso), 'dd MMM HH:mm') }
    catch { return iso }
}
const fmtMW = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}GW` : `${Math.round(v)}MW`

// ── sub-components ───────────────────────────────────────────────────
function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 16px', minWidth: 140,
        }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>
                {value}
            </div>
        </div>
    )
}

function Spinner() {
    return (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
                width: 36, height: 36, border: '3px solid var(--border2)',
                borderTopColor: 'var(--forecast)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Fetching wind data...
            </div>
        </div>
    )
}

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            fontFamily: 'var(--font-mono)',
        }}>
            <div style={{ color: 'var(--muted)', marginBottom: 6, fontSize: 11 }}>{fmt(label)}</div>
            {payload.map(p => (
                <div key={p.dataKey} style={{ color: p.color, marginBottom: 3 }}>
                    {p.dataKey === 'actual' ? '⬤ Actual' : '⬤ Forecast'}: {fmtMW(p.value)}
                </div>
            ))}
            {payload.length === 2 && (
                <div style={{ color: 'var(--muted)', marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    Δ {fmtMW(Math.abs(payload[0].value - payload[1].value))}
                </div>
            )}
        </div>
    )
}

// ── Main App ─────────────────────────────────────────────────────────
export default function App() {
    const today = new Date()
    const [startDate, setStartDate] = useState(format(subDays(today, 7), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(subDays(today, 6), 'yyyy-MM-dd'))
    const [horizon, setHorizon] = useState(4)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [meta, setMeta] = useState(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/chart-data?start_date=${startDate}&end_date=${endDate}&horizon_h=${horizon}`
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || 'API error')
            }
            const json = await res.json()
            setData(json.series)
            setMeta(json.meta)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [startDate, endDate, horizon])

    useEffect(() => { fetchData() }, [fetchData])

    // Compute stats
    const stats = (() => {
        if (!data?.length) return null
        const paired = data.filter(d => d.actual != null && d.forecast != null)
        if (!paired.length) return null
        const errors = paired.map(d => Math.abs(d.forecast - d.actual))
        const mae = errors.reduce((a, b) => a + b, 0) / errors.length
        const maxActual = Math.max(...data.filter(d => d.actual).map(d => d.actual))
        const minActual = Math.min(...data.filter(d => d.actual).map(d => d.actual))
        return { mae, maxActual, minActual, paired: paired.length }
    })()

    // Format X-axis ticks
    const tickFormatter = (iso) => {
        try { return format(parseISO(iso), 'dd MMM HH:mm') }
        catch { return '' }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            {/* Header */}
            <header style={{
                borderBottom: '1px solid var(--border)',
                padding: '0 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 60, position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(10,12,15,0.95)', backdropFilter: 'blur(8px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>💨</span>
                    <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>WindWatch</span>
                    <span style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)',
                        background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4,
                        border: '1px solid var(--border)',
                    }}>UK National Grid</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%', background: 'var(--forecast)',
                        animation: 'pulse 2s infinite',
                    }} />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>LIVE</span>
                </div>
            </header>

            <main style={{ padding: '24px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>

                {/* Controls */}
                <div className="fade-up" style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '20px 24px', marginBottom: 24,
                    display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end',
                }}>
                    {/* Start date */}
                    <div>
                        <label style={labelStyle}>Start Time</label>
                        <input type="date" value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            max={endDate} style={inputStyle} />
                    </div>

                    {/* End date */}
                    <div>
                        <label style={labelStyle}>End Time</label>
                        <input type="date" value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            min={startDate} style={inputStyle} />
                    </div>

                    {/* Horizon slider */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={labelStyle}>
                            Forecast Horizon:&nbsp;
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{horizon}h</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>0h</span>
                            <input type="range" min="0" max="48" step="1" value={horizon}
                                onChange={e => setHorizon(Number(e.target.value))}
                                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: 4 }} />
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>48h</span>
                        </div>
                    </div>

                    {/* Fetch button */}
                    <button onClick={fetchData} disabled={loading} style={{
                        background: loading ? 'var(--border)' : 'var(--forecast)',
                        color: loading ? 'var(--muted)' : '#000',
                        border: 'none', borderRadius: 8, padding: '10px 22px',
                        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                    }}>
                        {loading ? 'Loading…' : 'Update'}
                    </button>
                </div>

                {/* Stats row */}
                {stats && (
                    <div className="fade-up" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                        <StatCard label="MEAN ABS ERROR" value={fmtMW(stats.mae)} color="var(--accent)" />
                        <StatCard label="PEAK ACTUAL" value={fmtMW(stats.maxActual)} color="var(--actual)" />
                        <StatCard label="TROUGH ACTUAL" value={fmtMW(stats.minActual)} color="var(--actual)" />
                        <StatCard label="DATA POINTS" value={`${stats.paired} pairs`} />
                        {meta && <StatCard label="HORIZON APPLIED" value={`${meta.horizon_h}h`} color="var(--accent)" />}
                    </div>
                )}

                {/* Chart */}
                <div className="fade-up" style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '24px 16px 16px',
                }}>
                    <div style={{ marginBottom: 16, paddingLeft: 8 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                            Wind Power Generation — Actual vs Forecast
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                            {startDate} → {endDate} · horizon ≥ {horizon}h · latest valid forecast per target time
                        </p>
                    </div>

                    {loading && <Spinner />}

                    {error && (
                        <div style={{
                            textAlign: 'center', padding: '60px 0', color: 'var(--error)',
                            fontFamily: 'var(--font-mono)', fontSize: 13,
                        }}>
                            ⚠ {error}
                        </div>
                    )}

                    {!loading && !error && data && data.length > 0 && (
                        <ResponsiveContainer width="100%" height={420}>
                            <LineChart data={data} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={tickFormatter}
                                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                                    angle={-40} textAnchor="end" interval="preserveStartEnd"
                                    stroke="var(--border)"
                                />
                                <YAxis
                                    tickFormatter={fmtMW}
                                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                                    stroke="var(--border)"
                                    label={{
                                        value: 'Power (MW)', angle: -90, position: 'insideLeft',
                                        fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)', dy: 40
                                    }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ paddingTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                                    formatter={(value) => value === 'actual' ? 'Actual Generation' : 'Forecasted Generation'}
                                />
                                <Line
                                    type="monotone" dataKey="actual" stroke="var(--actual)"
                                    strokeWidth={2} dot={false} connectNulls={false}
                                    name="actual"
                                />
                                <Line
                                    type="monotone" dataKey="forecast" stroke="var(--forecast)"
                                    strokeWidth={2} dot={false} connectNulls={true}
                                    strokeDasharray="5 3"
                                    name="forecast"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}

                    {!loading && !error && (!data || data.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                            No data available for selected range.
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    Data: Elexon BMRS · FUELHH (actuals) · WINDFOR (forecasts) · Jan 2024 recommended
                </p>
            </main>
        </div>
    )
}

// shared styles
const labelStyle = {
    display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
    color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 6,
}
const inputStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer',
    colorScheme: 'dark',
}