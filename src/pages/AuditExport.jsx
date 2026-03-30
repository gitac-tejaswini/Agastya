import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const PERIOD_LABELS = { Q1:'Q1 (Apr–Jun)', Q2:'Q2 (Jul–Sep)', Q3:'Q3 (Oct–Dec)', Q4:'Q4 (Jan–Mar)', Annual:'Annual' }

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}
function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function AuditExport() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [filings, setFilings] = useState([])
  const [documents, setDocuments] = useState([])
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => { loadAll() }, [user])

  async function loadAll() {
    const { data: comp } = await supabase.from('companies').select('*').eq('user_id', user.id).single()
    if (!comp) return
    setCompany(comp)
    const { data: f } = await supabase.from('filings').select('*').eq('company_id', comp.id).eq('financial_year','2025-26')
    setFilings(f || [])
    const { data: docs } = await supabase.from('documents').select('*').eq('company_id', comp.id).order('uploaded_at', { ascending:true })
    setDocuments(docs || [])
    const { data: certsData } = await supabase.from('recycler_certificates').select('*').eq('company_id', comp.id).order('cert_date', { ascending:true })
    setCerts(certsData || [])
    const ds = Math.min(((docs?.length||0)/8)*50,50)
    const ts = Math.min(((certsData||[]).reduce((s,c)=>s+parseFloat(c.quantity_tonnes),0)/comp.annual_target_tonnes)*50,50)
    setScore(Math.round(ds+ts))
    setLoading(false)
  }

  function generateHTML() {
    const totalTonnes = certs.reduce((s,c)=>s+parseFloat(c.quantity_tonnes),0)
    const scoreColor = score>=70?'#00c896':score>=40?'#f59e0b':'#ef4444'
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>EPR Audit Package — ${company.name} — FY 2025-26</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0d1117;color:#e6edf3;font-family:'DM Sans',sans-serif;font-size:13px;padding:40px;}
.header{border-bottom:2px solid #00c896;padding-bottom:20px;margin-bottom:30px;}
.header h1{font-family:'DM Serif Display',serif;font-size:24px;color:#00c896;}
.header p{color:#7d8590;margin-top:4px;font-size:12px;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0;}
.meta-item{background:#161b22;border:1px solid #2a3441;border-radius:8px;padding:10px 14px;}
.meta-item .label{font-size:10px;color:#7d8590;text-transform:uppercase;letter-spacing:0.05em;}
.meta-item .value{font-size:14px;font-weight:600;color:#e6edf3;margin-top:2px;}
.score-box{background:#161b22;border:2px solid #00c896;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:20px;margin:20px 0;}
.score-number{font-family:'DM Serif Display',serif;font-size:48px;font-weight:800;color:${scoreColor};}
.score-label{font-size:16px;font-weight:600;color:#e6edf3;}
.score-sub{font-size:11px;color:#7d8590;margin-top:4px;}
h2{font-family:'DM Serif Display',serif;font-size:16px;color:#00c896;margin:30px 0 12px;padding-bottom:6px;border-bottom:1px solid #2a3441;}
table{width:100%;border-collapse:collapse;margin-bottom:10px;}
th{background:#161b22;text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#7d8590;border:1px solid #2a3441;}
td{padding:8px 12px;border:1px solid #2a3441;vertical-align:top;color:#e6edf3;}
tr:nth-child(even) td{background:#161b22;}
.badge{background:rgba(0,200,150,0.1);color:#00c896;padding:2px 8px;border-radius:4px;font-size:11px;}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #2a3441;color:#7d8590;font-size:11px;}
@media print{body{background:#fff;color:#000;} .score-number{color:${scoreColor};}}
</style></head><body>
<div class="header"><h1>♻ EPR Compliance Audit Package</h1>
<p>Generated on ${formatDateTime(new Date().toISOString())} · Financial Year 2025–26</p></div>
<div class="meta-grid">
<div class="meta-item"><div class="label">Company Name</div><div class="value">${company.name}</div></div>
<div class="meta-item"><div class="label">State</div><div class="value">${company.state}</div></div>
<div class="meta-item"><div class="label">EPR Registration</div><div class="value">${company.epr_reg_number||'Not yet assigned'}</div></div>
<div class="meta-item"><div class="label">Annual Target</div><div class="value">${company.annual_target_tonnes} MT</div></div>
<div class="meta-item"><div class="label">Alert Email</div><div class="value">${company.alert_email}</div></div>
<div class="meta-item"><div class="label">Tonnes Achieved</div><div class="value">${totalTonnes.toFixed(2)} MT (${((totalTonnes/company.annual_target_tonnes)*100).toFixed(1)}%)</div></div>
</div>
<div class="score-box"><div class="score-number">${score}</div>
<div><div class="score-label">Compliance Score / 100</div>
<div class="score-sub">Based on documents uploaded and tonnes achieved vs annual target</div></div></div>
<h2>Filing Status Summary</h2>
<table><thead><tr><th>Period</th><th>Type</th><th>Status</th></tr></thead><tbody>
${filings.sort((a,b)=>['Q1','Q2','Q3','Q4','Annual'].indexOf(a.period)-['Q1','Q2','Q3','Q4','Annual'].indexOf(b.period))
  .map(f=>`<tr><td>${PERIOD_LABELS[f.period]||f.period}</td><td>${f.period==='Annual'?'Annual Return':'Quarterly Return'}</td><td>${f.status}</td></tr>`).join('')}
</tbody></table>
<h2>Documents Uploaded (${documents.length})</h2>
${documents.length===0?'<p style="color:#7d8590;">No documents uploaded yet.</p>':`
<table><thead><tr><th>#</th><th>File Name</th><th>Type</th><th>Period</th><th>Uploaded At</th><th>Uploader</th></tr></thead><tbody>
${documents.map((doc,i)=>{const f=filings.find(f=>f.id===doc.filing_id);return`<tr><td>${i+1}</td><td><a href="${doc.file_url}" target="_blank" style="color:#00c896;">${doc.file_name}</a></td><td><span class="badge">${doc.doc_type}</span></td><td>${f?PERIOD_LABELS[f.period]:'—'}</td><td>${formatDateTime(doc.uploaded_at)}</td><td>${doc.uploader_email||'—'}</td></tr>`}).join('')}
</tbody></table>`}
<h2>Recycler Certificates (${certs.length})</h2>
${certs.length===0?'<p style="color:#7d8590;">No recycler certificates logged yet.</p>':`
<table><thead><tr><th>#</th><th>Recycler</th><th>CPCB Reg No.</th><th>Quantity</th><th>Cert Date</th><th>Expiry</th><th>Period</th></tr></thead><tbody>
${certs.map((c,i)=>{const f=filings.find(f=>f.id===c.filing_id);return`<tr><td>${i+1}</td><td>${c.recycler_name}</td><td style="font-family:monospace">${c.cpcb_reg_no}</td><td><strong>${c.quantity_tonnes} MT</strong></td><td>${formatDate(c.cert_date)}</td><td>${formatDate(c.expiry_date)}</td><td>${f?PERIOD_LABELS[f.period]:'—'}</td></tr>`}).join('')}
</tbody></table>`}
<div class="footer"><p>Auto-generated by EPR Comply · ${company.name} · FY 2025–26</p>
<p style="margin-top:4px;">All timestamps in IST. This serves as an audit trail for CPCB EPR compliance submissions.</p></div>
</body></html>`
  }

  async function handleGenerate() {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 800))
    const html = generateHTML()
    const blob = new Blob([html], { type:'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) win.focus()
    setGenerating(false)
  }

  const totalTonnes = certs.reduce((s,c)=>s+parseFloat(c.quantity_tonnes),0)

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px' }}>
        <p style={{ color:'var(--muted)' }}>Loading...</p>
      </div>
    </Layout>
  )

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px' }

  const summaryTiles = [
    { icon:'🏢', label:'Company',      val: company?.name },
    { icon:'📋', label:'Filings',      val: `${filings.length} periods` },
    { icon:'📁', label:'Documents',    val: `${documents.length} files` },
    { icon:'♻️', label:'Certificates', val: `${certs.length} entries` },
  ]

  return (
    <Layout>
      <div style={{ maxWidth:'1140px', margin:'0 auto' }}>

        {/* Page Header — matches Dashboard header style exactly */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'28px' }}>
          <div>
            <p style={{ fontSize:'11px', color:'var(--accent)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>
              Audit Export
            </p>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'28px', color:'var(--text)', lineHeight:1.1 }}>
              Generate Audit Package
            </h1>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>
              Complete compliance report for CPCB submission
            </p>
          </div>
        </div>

        {/* Main Grid — left content + right sidebar, mirrors dashboard layout */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px' }}>

          {/* Left Column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* Summary Tiles Row — 4 equal cards matching dashboard metric cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'16px' }}>
              {summaryTiles.map(tile => (
                <div key={tile.label} style={{ ...card, display:'flex', flexDirection:'column', justifyContent:'flex-start', padding:'24px 20px' }}>
                  <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'14px' }}>
                    {tile.label}
                  </p>
                  <p style={{ fontSize:'22px', marginBottom:'6px' }}>{tile.icon}</p>
                  <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text)', marginTop:'2px' }}>{tile.val}</p>
                </div>
              ))}
            </div>

            {/* Package Contents Card */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Package Contents
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'24px' }}>
                {[
                  `Company profile and EPR registration details`,
                  `Compliance score (${score}/100) with breakdown`,
                  `Filing status for all 5 periods (Q1–Q4 + Annual)`,
                  `${documents.length} uploaded documents with timestamps`,
                  `${certs.length} recycler certificates with CPCB reg numbers`,
                  `Tonnes achieved: ${totalTonnes.toFixed(2)} of ${company?.annual_target_tonnes} MT target`,
                  `Clickable links to every uploaded file`,
                ].map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'10px', fontSize:'13px', color:'var(--text)' }}>
                    <span style={{ color:'var(--accent)', flexShrink:0, marginTop:'1px' }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  width:'100%', padding:'13px', borderRadius:'10px',
                  fontSize:'14px', fontWeight:700, letterSpacing:'0.5px',
                  background: generating ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), #00a878)',
                  color: generating ? 'var(--muted)' : '#000',
                  border: generating ? '1px solid var(--border)' : 'none',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  transition:'opacity 0.15s',
                }}>
                {generating ? '⏳  Generating...' : '📦  Generate Audit Package'}
              </button>
            </div>

            {/* How to Save as PDF — instruction card */}
            <div style={{
              ...card,
              background:'rgba(245,158,11,0.07)',
              border:'1px solid rgba(245,158,11,0.2)',
            }}>
              <p style={{ fontSize:'13px', fontWeight:600, color:'var(--accent3)', marginBottom:'14px' }}>
                📋  How to save as PDF
              </p>
              <ol style={{ display:'flex', flexDirection:'column', gap:'8px', paddingLeft:'18px', listStyleType:'decimal' }}>
                {[
                  'Click "Generate Audit Package" above',
                  'A new tab opens with your full compliance report',
                  <>Press <strong>Ctrl + P</strong> (Windows) or <strong>Cmd + P</strong> (Mac)</>,
                  <>Set destination to <strong>"Save as PDF"</strong></>,
                  'Click Save ✅',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize:'12px', color:'var(--accent3)' }}>{step}</li>
                ))}
              </ol>
            </div>

          </div>

          {/* Right Column — Score preview card, mirrors Target Progress sidebar card */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Compliance Score preview */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Compliance Score
              </p>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <p style={{
                  fontFamily:'var(--serif)', fontSize:'56px', lineHeight:1,
                  color: score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--accent3)' : 'var(--danger)',
                }}>
                  {score}
                </p>
                <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>out of 100</p>
              </div>
              {/* Score bar */}
              <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', marginBottom:'12px', overflow:'hidden' }}>
                <div style={{
                  height:'6px', borderRadius:'3px', width:`${score}%`,
                  background: score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--accent3)' : 'var(--danger)',
                  transition:'width 0.6s ease',
                }} />
              </div>
              <p style={{ fontSize:'11px', color:'var(--muted)', textAlign:'center' }}>
                {score >= 70 ? '● Good Standing' : score >= 40 ? '● Needs Attention' : '● At Risk'}
              </p>
            </div>

            {/* Package snapshot */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Package Snapshot
              </p>
              {[
                { label:'Company',      val: company?.name },
                { label:'State',        val: company?.state },
                { label:'EPR Reg No.',  val: company?.epr_reg_number || 'Not assigned' },
                { label:'Annual Target',val: `${company?.annual_target_tonnes} MT` },
                { label:'Achieved',     val: `${totalTonnes.toFixed(2)} MT` },
                { label:'Filings',      val: `${filings.length} periods` },
                { label:'Documents',    val: `${documents.length} files` },
                { label:'Certificates', val: `${certs.length} entries` },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                  padding:'10px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  gap:'12px',
                }}>
                  <span style={{ fontSize:'11px', color:'var(--muted)', flexShrink:0 }}>{item.label}</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text)', textAlign:'right', wordBreak:'break-all' }}>{item.val}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}
