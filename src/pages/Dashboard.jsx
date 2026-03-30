import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

function daysUntil(d) {
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.ceil((new Date(d) - t) / 86400000)
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [deadlines, setDeadlines] = useState([])
  const [score, setScore] = useState(0)
  const [docScore, setDocScore] = useState(0)
  const [tonnesScore, setTonnesScore] = useState(0)
  const [totalDocs, setTotalDocs] = useState(0)
  const [tonnesAchieved, setTonnesAchieved] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    const { data: comp } = await supabase.from('companies').select('*').eq('user_id', user.id).single()
    if (!comp) return
    setCompany(comp)
    const { data: dl } = await supabase.from('deadlines').select('*').eq('financial_year', '2025-26')
    setDeadlines(dl || [])
    const { data: docs } = await supabase.from('documents').select('id').eq('company_id', comp.id)
    const { data: certs } = await supabase.from('recycler_certificates').select('quantity_tonnes').eq('company_id', comp.id)
    const dCount = docs?.length || 0
    const ds = Math.min((dCount / 8) * 50, 50)
    const tonnes = (certs || []).reduce((s, c) => s + parseFloat(c.quantity_tonnes), 0)
    const ts = Math.min((tonnes / comp.annual_target_tonnes) * 50, 50)
    setTotalDocs(dCount); setTonnesAchieved(tonnes)
    setDocScore(Math.round(ds)); setTonnesScore(Math.round(ts))
    setScore(Math.round(ds + ts)); setLoading(false)
  }

  const upcoming = deadlines.map(d => ({ ...d, days: daysUntil(d.due_date) })).filter(d => d.days >= 0).sort((a, b) => a.days - b.days)
  const next = upcoming[0]
  const isUrgent = next?.days <= 15
  const circumference = 220
  const offset = circumference - (score / 100) * circumference
  const pct = company ? Math.min((tonnesAchieved / company.annual_target_tonnes) * 100, 100) : 0

  const tiles = [
    { icon: '📋', label: 'Compliance Tracker', sub: 'View filing status', to: '/tracker' },
    { icon: '📁', label: 'Upload Document', sub: 'Add new files', to: '/documents' },
    { icon: '♻️', label: 'Add Recycler', sub: 'Log certificate', to: '/recyclers' },
    { icon: '📦', label: 'Audit Package', sub: 'Download report', to: '/export' },
  ]

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: 'var(--muted)' }}>Loading dashboard...</p>
      </div>
    </Layout>
  )

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }

  // Shared section label style — slightly larger and brighter than original muted
  const sectionLabel = {
    fontSize: '11px',
    color: 'var(--text)',
    opacity: 0.45,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1140px', margin: '0 auto' }}>

        {/* Page Header — LIVE badge left-aligned, avatar removed */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: '11px', padding: '5px 14px', borderRadius: '20px',
              fontWeight: 700, letterSpacing: '1px',
              background: 'rgba(0,200,150,0.12)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}>
              ● LIVE
            </div>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '28px', color: 'var(--text)', lineHeight: 1.1 }}>
            {company?.name}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
            {company?.state} · FY 2025–26{company?.epr_reg_number ? ` · ${company.epr_reg_number}` : ''}
          </p>
        </div>

        {/* Alert Banner */}
        {next && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 20px', borderRadius: '10px', marginBottom: '24px',
            background: isUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isUrgent ? 'var(--danger)' : 'var(--accent3)' }} />
            <p style={{ fontSize: '13px', color: isUrgent ? 'var(--danger)' : 'var(--accent3)' }}>
              <strong>{next.period === 'Annual' ? 'Annual Return' : `${next.period} Quarterly Return`}</strong> due in{' '}
              <strong>{next.days} days</strong>
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {new Date(next.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
          </div>
        )}

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Score Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

              {/* Score Ring */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px' }}>
                <p style={{ ...sectionLabel, marginBottom: '16px' }}>
                  Compliance Score
                </p>
                <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="35" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="35" fill="none"
                    stroke={score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--accent3)' : 'var(--danger)'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                  <text x="50" y="47" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: 'var(--serif)', fontSize: '22px', fill: 'var(--text)', transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>
                    {score}
                  </text>
                  <text x="50" y="60" textAnchor="middle"
                    style={{ fontSize: '9px', fill: 'var(--muted)', transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>
                    /100
                  </text>
                </svg>
                <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Documents', val: docScore, max: 50, color: 'var(--accent2)' },
                    { label: 'Tonnes', val: tonnesScore, max: 50, color: 'var(--accent)' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--muted)', width: '65px' }}>{item.label}</span>
                      <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
                        <div style={{ height: '3px', borderRadius: '2px', width: `${(item.val / item.max) * 100}%`, background: item.color }} />
                      </div>
                      <span style={{ color: item.color, width: '24px', textAlign: 'right' }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Docs Metric */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '24px 20px' }}>
                <p style={{ ...sectionLabel, marginBottom: '14px' }}>Documents Uploaded</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '48px', color: 'var(--accent2)', lineHeight: 1 }}>{totalDocs}</p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>files</p>
              </div>

              {/* Tonnes Metric */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '24px 20px' }}>
                <p style={{ ...sectionLabel, marginBottom: '14px' }}>Tonnes Achieved</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '48px', color: 'var(--accent)', lineHeight: 1 }}>{tonnesAchieved.toFixed(1)}</p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>MT</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={card}>
              <p style={{ ...sectionLabel, marginBottom: '16px' }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {tiles.map(tile => (
                  <button key={tile.to} onClick={() => navigate(tile.to)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '16px', borderRadius: '10px', textAlign: 'left',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(0,200,150,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}>
                    <span style={{ fontSize: '22px' }}>{tile.icon}</span>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{tile.label}</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{tile.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div style={card}>
              <p style={{ ...sectionLabel, marginBottom: '16px' }}>
                Upcoming Deadlines · FY 2025–26
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {upcoming.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>No upcoming deadlines.</p>
                ) : upcoming.map((d, i) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0',
                    borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
                        {d.period === 'Annual' ? 'Annual Return' : `${d.period} Quarterly Return`}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {new Date(d.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div style={{
                      fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '20px',
                      background: d.days <= 15 ? 'rgba(239,68,68,0.1)' : d.days <= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(0,200,150,0.1)',
                      color: d.days <= 15 ? 'var(--danger)' : d.days <= 30 ? 'var(--accent3)' : 'var(--accent)',
                      border: `1px solid ${d.days <= 15 ? 'rgba(239,68,68,0.3)' : d.days <= 30 ? 'rgba(245,158,11,0.3)' : 'rgba(0,200,150,0.3)'}`,
                    }}>
                      {d.days}d left
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Company Profile */}
            <div style={card}>
              <p style={{ ...sectionLabel, marginBottom: '16px' }}>Company Profile</p>
              {[
                { label: 'Name', val: company?.name },
                { label: 'State', val: company?.state },
                { label: 'EPR Reg No.', val: company?.epr_reg_number || 'Not assigned' },
                { label: 'Annual Target', val: `${company?.annual_target_tonnes} MT` },
                { label: 'Alert Email', val: company?.alert_email },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all' }}>{item.val}</span>
                </div>
              ))}
            </div>

            {/* Target Progress */}
            <div style={card}>
              <p style={{ ...sectionLabel, marginBottom: '16px' }}>Target Progress</p>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '36px', color: 'var(--accent)', lineHeight: 1 }}>
                  {pct.toFixed(1)}%
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>of annual target achieved</p>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{
                  height: '6px', borderRadius: '3px',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                <span>{tonnesAchieved.toFixed(1)} MT achieved</span>
                <span>{company?.annual_target_tonnes} MT target</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}
