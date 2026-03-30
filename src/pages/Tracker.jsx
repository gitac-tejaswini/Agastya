import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const STATUS_OPTIONS = ['Not started','In progress','Ready to submit','Submitted']
const PERIOD_ORDER = ['Q1','Q2','Q3','Q4','Annual']
const PERIOD_LABELS = { Q1:'Q1 (Apr–Jun)', Q2:'Q2 (Jul–Sep)', Q3:'Q3 (Oct–Dec)', Q4:'Q4 (Jan–Mar)', Annual:'Annual' }
const DOCS_REQUIRED = { Q1:3, Q2:3, Q3:3, Q4:3, Annual:5 }

const STATUS_COLORS = {
  'Not started':     { bg:'rgba(125,133,144,0.15)', color:'#7d8590',  border:'rgba(125,133,144,0.2)' },
  'In progress':     { bg:'rgba(0,153,255,0.1)',    color:'#0099ff',  border:'rgba(0,153,255,0.2)'   },
  'Ready to submit': { bg:'rgba(245,158,11,0.1)',   color:'#f59e0b',  border:'rgba(245,158,11,0.2)'  },
  'Submitted':       { bg:'rgba(0,200,150,0.1)',    color:'#00c896',  border:'rgba(0,200,150,0.2)'   },
}

export default function Tracker() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [filings, setFilings] = useState([])
  const [docCounts, setDocCounts] = useState({})
  const [tonnesAchieved, setTonnesAchieved] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => { loadAll() }, [user])

  async function loadAll() {
    const { data: comp } = await supabase.from('companies').select('*').eq('user_id', user.id).single()
    if (!comp) return
    setCompany(comp)
    const { data: filingsData } = await supabase.from('filings').select('*')
      .eq('company_id', comp.id).eq('financial_year', '2025-26')
    setFilings((filingsData || []).sort((a,b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)))
    const { data: docs } = await supabase.from('documents').select('filing_id').eq('company_id', comp.id)
    const counts = {}
    ;(docs || []).forEach(d => { if (d.filing_id) counts[d.filing_id] = (counts[d.filing_id] || 0) + 1 })
    setDocCounts(counts)
    const { data: certs } = await supabase.from('recycler_certificates').select('quantity_tonnes').eq('company_id', comp.id)
    setTonnesAchieved((certs || []).reduce((s,c) => s + parseFloat(c.quantity_tonnes), 0))
    setLoading(false)
  }

  async function updateStatus(filingId, newStatus) {
    setUpdatingId(filingId)
    await supabase.from('filings').update({ status: newStatus }).eq('id', filingId)
    setFilings(prev => prev.map(f => f.id === filingId ? { ...f, status: newStatus } : f))
    setUpdatingId(null)
  }

  const pct = company ? Math.min((tonnesAchieved / company.annual_target_tonnes) * 100, 100) : 0
  const submittedCount = filings.filter(f => f.status === 'Submitted').length
  const inProgressCount = filings.filter(f => f.status === 'In progress').length

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px' }}>
        <p style={{ color:'var(--muted)' }}>Loading tracker...</p>
      </div>
    </Layout>
  )

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px' }

  return (
    <Layout>
      <div style={{ maxWidth:'1140px', margin:'0 auto' }}>

        {/* Page Header — matches Dashboard */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'28px' }}>
          <div>
            <p style={{ fontSize:'11px', color:'var(--accent)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>
              Compliance Tracker
            </p>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'28px', color:'var(--text)', lineHeight:1.1 }}>
              Filing Periods · FY 2025–26
            </h1>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>
              {company?.name}
            </p>
          </div>
        </div>

        {/* Main Grid — 1fr 300px matches Dashboard */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px' }}>

          {/* Left Column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* Tonnes Progress Card */}
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                  Plastic Waste Target Progress
                </p>
                <span style={{ fontSize:'11px', color:'var(--accent)', fontWeight:600 }}>
                  {tonnesAchieved.toFixed(1)} / {company?.annual_target_tonnes} MT
                </span>
              </div>
              <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', marginBottom:'20px', overflow:'hidden' }}>
                <div style={{
                  height:'6px', borderRadius:'3px', width:`${pct}%`,
                  background: pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--accent3)' : 'var(--danger)',
                  transition:'width 0.6s ease',
                }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
                {[
                  { label:'Achieved', val:`${tonnesAchieved.toFixed(1)} MT`, color:'var(--accent)' },
                  { label:'Target',   val:`${company?.annual_target_tonnes} MT`, color:'var(--text)' },
                  { label:'Remaining',val:`${Math.max(0, company?.annual_target_tonnes - tonnesAchieved).toFixed(1)} MT`, color:'var(--danger)' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign:'center' }}>
                    <p style={{ fontFamily:'var(--serif)', fontSize:'24px', fontWeight:700, color:m.color, lineHeight:1 }}>{m.val}</p>
                    <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Filing Table Card */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                  Filing Status
                </p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:'var(--surface2)' }}>
                    {['Period','Type','Status','Documents','Update Status'].map(h => (
                      <th key={h} style={{
                        padding:'11px 20px', textAlign:'left', fontSize:'10px',
                        textTransform:'uppercase', letterSpacing:'1px',
                        color:'var(--muted)', fontWeight:600,
                        borderBottom:'1px solid var(--border)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filings.map((filing, i) => {
                    const docCount = docCounts[filing.id] || 0
                    const required = DOCS_REQUIRED[filing.period] || 3
                    const sc = STATUS_COLORS[filing.status]
                    return (
                      <tr key={filing.id} style={{ borderBottom: i < filings.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding:'16px 20px', fontWeight:600, color:'var(--text)', fontSize:'13px' }}>
                          {PERIOD_LABELS[filing.period]}
                        </td>
                        <td style={{ padding:'16px 20px', color:'var(--muted)', fontSize:'12px' }}>
                          {filing.period === 'Annual' ? 'Annual return' : 'Quarterly return'}
                        </td>
                        <td style={{ padding:'16px 20px' }}>
                          <span style={{
                            background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`,
                            padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700,
                          }}>
                            {filing.status}
                          </span>
                        </td>
                        <td style={{ padding:'16px 20px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'72px', height:'4px', background:'var(--border)', borderRadius:'2px' }}>
                              <div style={{
                                height:'4px', borderRadius:'2px',
                                width:`${Math.min((docCount/required)*100,100)}%`,
                                background: docCount >= required ? 'var(--accent)' : 'var(--accent2)',
                              }} />
                            </div>
                            <span style={{ fontSize:'11px', color: docCount >= required ? 'var(--accent)' : 'var(--muted)' }}>
                              {docCount}/{required}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:'16px 20px' }}>
                          <select
                            value={filing.status}
                            disabled={updatingId === filing.id}
                            onChange={e => updateStatus(filing.id, e.target.value)}
                            style={{
                              padding:'6px 10px', fontSize:'11px',
                              background:'var(--surface2)', border:'1px solid var(--border)',
                              borderRadius:'8px', color:'var(--text)', cursor:'pointer',
                            }}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Status Legend */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Status Guide
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
                {STATUS_OPTIONS.map(s => {
                  const sc = STATUS_COLORS[s]
                  return (
                    <span key={s} style={{
                      background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`,
                      padding:'5px 14px', borderRadius:'20px', fontSize:'11px', fontWeight:700,
                    }}>
                      {s}
                    </span>
                  )
                })}
              </div>
            </div>

          </div>

          {/* Right Column — sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Filing Overview — mirrors Company Profile card */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Filing Overview
              </p>
              {[
                { label:'Total Periods',   val:`${filings.length}` },
                { label:'Submitted',       val:`${submittedCount}` },
                { label:'In Progress',     val:`${inProgressCount}` },
                { label:'Not Started',     val:`${filings.filter(f => f.status === 'Not started').length}` },
                { label:'Ready to Submit', val:`${filings.filter(f => f.status === 'Ready to submit').length}` },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize:'11px', color:'var(--muted)' }}>{item.label}</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text)' }}>{item.val}</span>
                </div>
              ))}
            </div>

            {/* Target Progress — mirrors Dashboard right sidebar card */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Target Progress
              </p>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <p style={{ fontFamily:'var(--serif)', fontSize:'36px', color:'var(--accent)', lineHeight:1 }}>
                  {pct.toFixed(1)}%
                </p>
                <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>of annual target achieved</p>
              </div>
              <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', marginBottom:'12px', overflow:'hidden' }}>
                <div style={{
                  height:'6px', borderRadius:'3px', width:`${pct}%`,
                  background:'linear-gradient(90deg, var(--accent), var(--accent2))',
                  transition:'width 0.6s ease',
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--muted)' }}>
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
