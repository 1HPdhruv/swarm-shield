import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0e1a',
  surface:  '#111827',
  card:     '#1a2236',
  border:   '#1e2d45',
  text:     '#e2e8f0',
  muted:    '#64748b',
  green:    '#10b981',
  greenBg:  '#052e1f',
  yellow:   '#f59e0b',
  yellowBg: '#2d1f04',
  red:      '#ef4444',
  redBg:    '#2d0a0a',
  blue:     '#3b82f6',
  blueBg:   '#0c1a3a',
  purple:   '#a855f7',
  purpleBg: '#1e0a3a',
  teal:     '#14b8a6',
}

const SEV_COLOR = { clear: C.green, mild: C.yellow, moderate: C.yellow, severe: C.red, catastrophic: C.red }
const SEV_BG    = { clear: C.greenBg, mild: C.yellowBg, moderate: C.yellowBg, severe: C.redBg, catastrophic: C.redBg }
const STATUS_COLOR = { paid: C.green, flagged: C.yellow, held: C.red, 'pre-paid': C.blue, 'pre-payed': C.blue }
const TIER_COLOR = { basic: C.teal, standard: C.blue, premium: C.purple }
const DIS_EMOJI  = { storm: '⛈', flood: '🌊', aqi: '🌫', bandh: '🚫', forecast: '🔮', voting: '🗳' }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt_inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const fmt_pct = (r)  => `${Math.round(r * 100)}%`

function Badge({ label, color, bg, small }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 20,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      background: bg || '#1e2d45',
      color: color || C.text,
      textTransform: 'uppercase',
    }}>{label}</span>
  )
}

function Stat({ label, value, color, sub }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color || C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SwarmBar({ ratio, triggered, borderline }) {
  const pct = Math.min(ratio * 100, 100)
  const barColor = triggered ? C.red : borderline ? C.yellow : C.green
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4 }}>
        <span>offline ratio</span>
        <span style={{ color: barColor, fontWeight: 600 }}>{fmt_pct(ratio)}</span>
      </div>
      <div style={{ height: 8, background: '#1e2d45', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: 4,
          transition: 'width 0.6s ease, background 0.3s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.muted }}>threshold 65%</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor }} />
          <span style={{ fontSize: 10, color: barColor, fontWeight: 600 }}>
            {triggered ? 'TRIGGERED' : borderline ? 'BORDERLINE' : 'SAFE'}
          </span>
        </div>
      </div>
    </div>
  )
}

function WorkerGrid({ workers }) {
  if (!workers || workers.length === 0) return null
  const sample = workers.slice(0, 80)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 10 }}>
      {sample.map(w => (
        <div key={w.id} title={`${w.id} | ${w.tier} | ${fmt_inr(w.weekly_earnings)}/wk`}
          style={{
            width: 9, height: 9, borderRadius: '50%',
            background: w.online ? C.green : '#374151',
            transition: 'background 0.4s',
            cursor: 'default',
          }} />
      ))}
    </div>
  )
}

function VotingPanel({ city_id, voteData, onVote }) {
  if (!voteData?.active) return null
  const pct = Math.min((voteData.count / voteData.required) * 100, 100)
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 8,
      background: C.purpleBg, border: `1px solid ${C.purple}44`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, marginBottom: 8 }}>
        🗳 Mutual Voting Active — Layer 3
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        Swarm borderline. Waiting for quorum: {voteData.count} / {voteData.required} workers
      </div>
      <div style={{ height: 6, background: '#2d1a45', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.purple, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <button onClick={() => onVote(city_id)} style={btnStyle(C.purple, C.purpleBg, true)}>
        Simulate Votes ↗
      </button>
    </div>
  )
}

function PayoutRow({ p }) {
  const sc = STATUS_COLOR[p.status] || C.muted
  const tc = TIER_COLOR[p.tier] || C.muted
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
      fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 10 }}>{p.id}</span>
        <span style={{ color: C.muted }}>{p.city}</span>
        <Badge label={p.tier} color={tc} bg={tc + '22'} small />
        {p.severity && (
          <span style={{ color: C.muted, fontSize: 10 }}>{DIS_EMOJI[p.severity] || ''} {p.severity}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, color: sc }}>{fmt_inr(p.amount)}</span>
        <Badge label={p.status} color={sc} bg={sc + '22'} small />
      </div>
    </div>
  )
}

const btnStyle = (color, bg, small) => ({
  padding: small ? '5px 12px' : '7px 14px',
  borderRadius: 6,
  border: `1px solid ${color}66`,
  background: bg,
  color: color,
  fontSize: small ? 11 : 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity .15s',
  whiteSpace: 'nowrap',
})

// ── City Card ────────────────────────────────────────────────────────────────
function CityCard({ city_id, data, workers, onSimulate, onReset, onVote, onForecast, loading }) {
  const sw  = data?.swarm    || {}
  const wth = data?.weather  || {}
  const dis = data?.disruption || {}
  const vot = data?.votes    || {}
  const sevColor = SEV_COLOR[wth.severity] || C.green
  const sevBg    = SEV_BG[wth.severity]    || C.greenBg
  const border   = dis.active ? `1px solid ${C.red}55`
                 : sw.triggered ? `1px solid ${C.red}44`
                 : sw.borderline ? `1px solid ${C.yellow}44`
                 : `1px solid ${C.border}`

  return (
    <div style={{ background: C.card, borderRadius: 12, border, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{data?.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sw.total} registered workers</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <Badge label={wth.severity || 'clear'} color={sevColor} bg={sevBg} />
          {dis.active && (
            <Badge label={`${DIS_EMOJI[dis.type] || ''} ${dis.type}`} color={C.red} bg={C.redBg} />
          )}
        </div>
      </div>

      {/* Weather */}
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
        <span>AQI <b style={{ color: wth.aqi > 200 ? C.red : wth.aqi > 100 ? C.yellow : C.green }}>{wth.aqi}</b></span>
        <span>Rain <b style={{ color: C.text }}>{Math.round((wth.rain_prob || 0) * 100)}%</b></span>
        <span>Temp <b style={{ color: C.text }}>{wth.temp}°C</b></span>
        <span>Wind <b style={{ color: C.text }}>{wth.wind_kmh} km/h</b></span>
      </div>

      {/* Swarm bar */}
      <SwarmBar ratio={sw.ratio || 0} triggered={sw.triggered} borderline={sw.borderline} />

      {/* Worker grid */}
      <WorkerGrid workers={workers} />

      {/* Voting */}
      <VotingPanel city_id={city_id} voteData={vot} onVote={onVote} />

      {/* Trigger layer indicator */}
      {sw.triggered && !dis.active && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.red}44`, fontSize: 11, color: C.red, fontWeight: 600 }}>
          ⚡ Swarm Layer 2 triggered — payout queued
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button disabled={loading} onClick={() => onSimulate(city_id, 'storm')}  style={btnStyle(C.blue, C.blueBg)}>⛈ Storm</button>
        <button disabled={loading} onClick={() => onSimulate(city_id, 'flood')}  style={btnStyle(C.blue, C.blueBg)}>🌊 Flood</button>
        <button disabled={loading} onClick={() => onSimulate(city_id, 'aqi')}    style={btnStyle(C.yellow, C.yellowBg)}>🌫 AQI</button>
        <button disabled={loading} onClick={() => onSimulate(city_id, 'bandh')}  style={btnStyle(C.yellow, C.yellowBg)}>🚫 Bandh</button>
        <button disabled={loading} onClick={() => onForecast(city_id)}           style={btnStyle(C.purple, C.purpleBg)}>🔮 Forecast</button>
        <button disabled={loading} onClick={() => onReset(city_id)}              style={btnStyle(C.muted, '#1e2d45')}>↺ Reset</button>
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dash, setDash]        = useState(null)
  const [cityWorkers, setCW]   = useState({})
  const [loading, setLoading]  = useState(false)
  const [lastAct, setLastAct]  = useState(null)
  const [error, setError]      = useState(null)

  const fetchDash = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/dashboard`)
      const d = await r.json()
      setDash(d)
      setError(null)
    } catch (e) {
      setError('Cannot reach API — is the backend running?')
    }
  }, [])

  const fetchWorkers = useCallback(async (city_id) => {
    try {
      const r = await fetch(`${API}/api/workers/${city_id}`)
      const d = await r.json()
      setCW(prev => ({ ...prev, [city_id]: d.workers }))
    } catch {}
  }, [])

  useEffect(() => {
    fetchDash()
    const id = setInterval(fetchDash, 4000)
    return () => clearInterval(id)
  }, [fetchDash])

  useEffect(() => {
    if (!dash) return
    Object.keys(dash.cities || {}).forEach(fetchWorkers)
  }, [dash, fetchWorkers])

  const simulate = async (city_id, type) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/simulate/${city_id}/${type}`, { method: 'POST' })
      const d = await r.json()
      setLastAct({ type: 'simulate', city: d.city, disruption: type, layer: d.layer_fired, payout: d.payout_fired })
      await fetchDash()
      await fetchWorkers(city_id)
    } finally { setLoading(false) }
  }

  const reset = async (city_id) => {
    setLoading(true)
    try {
      await fetch(`${API}/api/reset/${city_id}`, { method: 'POST' })
      setLastAct({ type: 'reset', city: city_id })
      await fetchDash()
      await fetchWorkers(city_id)
    } finally { setLoading(false) }
  }

  const vote = async (city_id) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/vote/${city_id}`, { method: 'POST' })
      const d = await r.json()
      setLastAct({ type: 'vote', city: city_id, quorum: d.quorum_reached, votes: d.votes })
      await fetchDash()
    } finally { setLoading(false) }
  }

  const forecast = async (city_id) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/forecast-prepay/${city_id}`, { method: 'POST' })
      const d = await r.json()
      setLastAct({ type: 'forecast', city: city_id, workers: d.workers_prepaid, total: d.total_disbursed, confidence: d.confidence })
      await fetchDash()
    } finally { setLoading(false) }
  }

  const stats = dash?.stats || {}
  const payouts = dash?.recent_payouts || []
  const cities  = dash?.cities || {}

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>

      {/* Topbar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Predictive Swarm Shield</div>
              <div style={{ fontSize: 10, color: C.muted }}>AI Parametric Insurance · Gig Economy India</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <Stat label="Total Workers" value={(stats.total_workers || 0).toLocaleString()} color={C.blue} />
            <Stat label="Disruptions Active" value={stats.active_disruptions || 0} color={stats.active_disruptions ? C.red : C.green} />
            <Stat label="Total Payouts" value={stats.total_payouts || 0} color={C.purple} />
            <Stat label="Total Disbursed" value={fmt_inr(stats.total_paid_inr || 0)} color={C.green} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* Error banner */}
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.red}44`, color: C.red, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Last action toast */}
        {lastAct && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: C.blueBg, border: `1px solid ${C.blue}44`, color: C.blue, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {lastAct.type === 'simulate' && `⚡ ${lastAct.disruption.toUpperCase()} simulated in ${lastAct.city} · Layer fired: ${lastAct.layer} · Payout: ${lastAct.payout ? 'YES' : 'pending'}`}
              {lastAct.type === 'reset'    && `✓ ${lastAct.city} reset — all workers back online`}
              {lastAct.type === 'vote'     && `🗳 ${lastAct.votes} votes cast in ${lastAct.city} · Quorum: ${lastAct.quorum ? 'REACHED' : 'pending'}`}
              {lastAct.type === 'forecast' && `🔮 Forecast pre-pay: ${lastAct.workers} workers · ${fmt_inr(lastAct.total)} disbursed · Confidence: ${Math.round(lastAct.confidence * 100)}%`}
            </span>
            <button onClick={() => setLastAct(null)} style={{ background: 'none', border: 'none', color: C.blue, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}

        {/* Layer legend */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '🔮 Layer 1: Forecast', color: C.purple, desc: '48-hr advance pre-payout' },
            { label: '⚡ Layer 2: Swarm',    color: C.red,    desc: '65% offline → auto-trigger' },
            { label: '🗳 Layer 3: Voting',   color: C.yellow, desc: '12 votes → consensus trigger' },
          ].map(l => (
            <div key={l.label} style={{ padding: '6px 14px', borderRadius: 8, background: C.card, border: `1px solid ${l.color}44`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: l.color }}>{l.label}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{l.desc}</span>
            </div>
          ))}
          <div style={{ padding: '6px 14px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green }} /><span style={{ fontSize: 11, color: C.muted }}>online</span>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151', marginLeft: 6 }} /><span style={{ fontSize: 11, color: C.muted }}>offline</span>
          </div>
        </div>

        {/* City grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Object.entries(cities).map(([city_id, data]) => (
            <CityCard key={city_id} city_id={city_id} data={data}
              workers={cityWorkers[city_id] || []}
              onSimulate={simulate} onReset={reset} onVote={vote} onForecast={forecast}
              loading={loading} />
          ))}
        </div>

        {/* Payout feed */}
        {payouts.length > 0 && (
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Live Payout Feed</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
                <span><span style={{ color: C.green }}>●</span> paid</span>
                <span><span style={{ color: C.yellow }}>●</span> flagged</span>
                <span><span style={{ color: C.red }}>●</span> held</span>
                <span><span style={{ color: C.blue }}>●</span> pre-paid</span>
              </div>
            </div>
            <div style={{ maxHeight: 340, overflow: 'auto' }}>
              {payouts.map(p => <PayoutRow key={p.id + p.timestamp} p={p} />)}
            </div>
          </div>
        )}

        {!dash && !error && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <div>Connecting to Swarm Shield API...</div>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: C.muted }}>
          Merge A: Swarm Sensor (01) + Forecast-Forward (02) + Mutual Voting (08) · Auto-refreshes every 4s · API: {API}
        </div>
      </div>
    </div>
  )
}
