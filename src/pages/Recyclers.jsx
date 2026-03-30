import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const PERIODS = ['Q1','Q2','Q3','Q4','Annual']
const PERIOD_LABELS = { Q1:'Q1 (Apr–Jun)', Q2:'Q2 (Jul–Sep)', Q3:'Q3 (Oct–Dec)', Q4:'Q4 (Jan–Mar)', Annual:'Annual' }

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}
function formatBytes(b) {
  if (!b) return ''
  return b < 1024*1024 ? (b/1024).toFixed(1)+' KB' : (b/(1024*1024)).toFixed(1)+' MB'
}
function expiryStatus(expiryDate) {
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000*60*60*24))
  if (days < 0)   return { label:'Expired',           color:'var(--danger)',  bg:'rgba(239,68,68,0.1)',   border:'rgba(239,68,68,0.2)',   rowBg:'rgba(239,68,68,0.04)'   }
  if (days <= 30) return { label:`Expires in ${days}d`, color:'var(--accent3)', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.2)', rowBg:'rgba(245,158,11,0.04)' }
  return            { label:`Valid · ${days}d`,       color:'var(--accent)',  bg:'rgba(0,200,150,0.1)',   border:'rgba(0,200,150,0.2)',   rowBg:''                       }
}

export default function Recyclers() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [filings, setFilings] = useState([])
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [form, setForm] = useState({ recycler_name:'', cpcb_reg_no:'', cert_date:'', expiry_date:'', quantity_tonnes:'', period:'' })

  useEffect(() => { loadAll() }, [user])

  async function loadAll() {
    const { data: comp } = await supabase.from('companies').select('*').eq('user_id', user.id).single()
    if (!comp) return
    setCompany(comp)
    const { data: f } = await supabase.from('filings').select('*').eq('company_id', comp.id).eq('financial_year','2025-26')
    setFilings(f || [])
    await loadCerts(comp.id)
    setLoading(false)
  }

  async function loadCerts(companyId) {
    const { data } = await supabase.from('recycler_certificates').select('*').eq('company_id', companyId).order('created_at', { ascending:false })
    setCerts(data || [])
  }

  async function handleSubmit() {
    if (!form.recycler_name)    return setFormError('Recycler name is required.')
    if (!form.cpcb_reg_no)      return setFormError('CPCB Reg No. is required.')
    if (!form.cert_date)        return setFormError('Certificate date is required.')
    if (!form.expiry_date)      return setFormError('Expiry date is required.')
    if (!form.quantity_tonnes)  return setFormError('Quantity is required.')
    if (!form.period)           return setFormError('Filing period is required.')
    setSubmitting(true); setFormError('')
    try {
      let fileUrl = null
      if (selectedFile) {
        const filePath = `${company.id}/recycler_${Date.now()}_${selectedFile.name}`
        const { error: se } = await supabase.storage.from('documents').upload(filePath, selectedFile)
        if (se) throw se
        const { data: u } = supabase.storage.from('documents').getPublicUrl(filePath)
        fileUrl = u.publicUrl
      }
      const filing = filings.find(f => f.period === form.period)
      const { error: de } = await supabase.from('recycler_certificates').insert({
        company_id: company.id, filing_id: filing?.id || null,
        recycler_name: form.recycler_name, cpcb_reg_no: form.cpcb_reg_no,
        cert_date: form.cert_date, expiry_date: form.expiry_date,
        quantity_tonnes: parseFloat(form.quantity_tonnes), file_url: fileUrl,
      })
      if (de) throw de
      setForm({ recycler_name:'', cpcb_reg_no:'', cert_date:'', expiry_date:'', quantity_tonnes:'', period:'' })
      setSelectedFile(null); setShowForm(false)
      await loadCerts(company.id)
    } catch (err) { setFormError(err.message) }
    setSubmitting(false)
  }

  async function handleDelete(cert) {
    if (!confirm(`Delete certificate from "${cert.recycler_name}"?`)) return
    if (cert.file_url) {
      const fp = cert.file_url.split('/documents/')[1]
      await supabase.storage.from('documents').remove([fp])
    }
    await supabase.from('recycler_certificates').delete().eq('id', cert.id)
    setCerts(prev => prev.filter(c => c.id !== cert.id))
  }

  const totalTonnes   = certs.reduce((s,c) => s + parseFloat(c.quantity_tonnes), 0)
  const expiredCount  = certs.filter(c => new Date(c.expiry_date) < new Date()).length
  const expiringSoon  = certs.filter(c => { const d = Math.ceil((new Date(c.expiry_date)-new Date())/(1000*60*60*24)); return d>=0&&d<=30 }).length
  const pct           = company ? Math.min((totalTonnes / company.annual_target_tonnes) * 100, 100) : 0

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px' }}>
        <p style={{ color:'var(--muted)' }}>Loading...</p>
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
              Recycler Network
            </p>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'28px', color:'var(--text)', lineHeight:1.1 }}>
              Certificate Log
            </h1>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>
              {company?.name} · FY 2025–26
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            style={{
              background:'linear-gradient(135deg, var(--accent), #00a878)', color:'#000',
              fontWeight:700, fontSize:'12px', padding:'10px 20px', borderRadius:'9px',
              border:'none', cursor:'pointer', letterSpacing:'0.5px', marginTop:'4px',
            }}>
            + Add Certificate
          </button>
        </div>

        {/* Main Grid — 1fr 300px matches Dashboard */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px' }}>

          {/* Left Column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* Summary Tiles Row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
              {[
                { label:'Total Tonnes Certified', val:`${totalTonnes.toFixed(1)} MT`, color:'var(--accent)',  sub:'certified so far' },
                { label:'Expired Certificates',   val:`${expiredCount}`,              color: expiredCount  > 0 ? 'var(--danger)'  : 'var(--text)', sub:'need renewal' },
                { label:'Expiring in 30 Days',    val:`${expiringSoon}`,              color: expiringSoon  > 0 ? 'var(--accent3)' : 'var(--text)', sub:'act soon' },
              ].map(m => (
                <div key={m.label} style={{ ...card, display:'flex', flexDirection:'column', justifyContent:'flex-start', padding:'24px 20px' }}>
                  <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'14px' }}>
                    {m.label}
                  </p>
                  <p style={{ fontFamily:'var(--serif)', fontSize:'36px', color:m.color, lineHeight:1 }}>{m.val}</p>
                  <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Certificate Table Card */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              {certs.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 24px', textAlign:'center' }}>
                  <span style={{ fontSize:'48px', marginBottom:'16px' }}>♻️</span>
                  <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text)', marginBottom:'6px' }}>No certificates logged yet</p>
                  <p style={{ fontSize:'12px', color:'var(--muted)' }}>Add your first recycler certificate above</p>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)' }}>
                      {['Recycler','CPCB Reg No.','Quantity','Period','Expiry','Actions'].map(h => (
                        <th key={h} style={{
                          padding:'12px 18px', textAlign:'left', fontSize:'10px',
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
                    {certs.map((cert, i) => {
                      const st = expiryStatus(cert.expiry_date)
                      const filing = filings.find(f => f.id === cert.filing_id)
                      return (
                        <tr key={cert.id} style={{ borderBottom: i < certs.length - 1 ? '1px solid var(--border)' : 'none', background:st.rowBg }}>
                          <td style={{ padding:'14px 18px' }}>
                            <p style={{ color:'var(--text)', fontWeight:600, fontSize:'12px' }}>{cert.recycler_name}</p>
                            <p style={{ color:'var(--muted)', fontSize:'11px', marginTop:'2px' }}>Cert: {formatDate(cert.cert_date)}</p>
                          </td>
                          <td style={{ padding:'14px 18px', color:'var(--muted)', fontFamily:'monospace', fontSize:'11px' }}>
                            {cert.cpcb_reg_no}
                          </td>
                          <td style={{ padding:'14px 18px' }}>
                            <span style={{ color:'var(--accent)', fontWeight:700 }}>{cert.quantity_tonnes}</span>
                            <span style={{ color:'var(--muted)', fontSize:'11px' }}> MT</span>
                          </td>
                          <td style={{ padding:'14px 18px', color:'var(--muted)', fontSize:'11px' }}>
                            {filing ? PERIOD_LABELS[filing.period] : '—'}
                          </td>
                          <td style={{ padding:'14px 18px' }}>
                            <span style={{
                              background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                              padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700,
                            }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding:'14px 18px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                              {cert.file_url && (
                                <button onClick={() => window.open(cert.file_url,'_blank')}
                                  style={{ color:'var(--accent2)', fontSize:'11px', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                  ↓ View
                                </button>
                              )}
                              <button onClick={() => handleDelete(cert)}
                                style={{ color:'var(--danger)', fontSize:'11px', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* Right Column — sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Target Progress — identical to Dashboard */}
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
                <span>{totalTonnes.toFixed(1)} MT achieved</span>
                <span>{company?.annual_target_tonnes} MT target</span>
              </div>
            </div>

            {/* Certificate Stats — mirrors Company Profile card */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Certificate Stats
              </p>
              {[
                { label:'Total Certificates', val:`${certs.length}` },
                { label:'Valid',              val:`${certs.length - expiredCount - expiringSoon}` },
                { label:'Expiring Soon',      val:`${expiringSoon}` },
                { label:'Expired',            val:`${expiredCount}` },
                { label:'Tonnes Certified',   val:`${totalTonnes.toFixed(2)} MT` },
                { label:'Annual Target',      val:`${company?.annual_target_tonnes} MT` },
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

          </div>
        </div>

        {/* Add Certificate Modal */}
        {showForm && (
          <div style={{
            position:'fixed', inset:0, zIndex:50,
            display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
            background:'rgba(0,0,0,0.7)',
          }}>
            <div style={{
              width:'100%', maxWidth:'480px', borderRadius:'16px', padding:'28px',
              background:'var(--surface)', border:'1px solid var(--border)',
              maxHeight:'90vh', overflowY:'auto',
            }}>

              {/* Modal Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
                <div>
                  <p style={{ fontSize:'11px', color:'var(--accent)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>Recycler Network</p>
                  <h2 style={{ fontFamily:'var(--serif)', color:'var(--text)', fontSize:'20px' }}>Add Certificate</h2>
                </div>
                <button
                  onClick={() => { setShowForm(false); setFormError('') }}
                  style={{ color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>
                  ✕
                </button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Recycler Name */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>Recycler Name *</label>
                  <input name="recycler_name" value={form.recycler_name} placeholder="Green Recyclers Pvt. Ltd."
                    onChange={e => setForm({ ...form, recycler_name:e.target.value })} />
                </div>

                {/* CPCB Reg No */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>CPCB Registration Number *</label>
                  <input name="cpcb_reg_no" value={form.cpcb_reg_no} placeholder="CPCB/REC/2024/XXXXX"
                    onChange={e => setForm({ ...form, cpcb_reg_no:e.target.value })} />
                </div>

                {/* Dates */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>Certificate Date *</label>
                    <input type="date" value={form.cert_date} onChange={e => setForm({ ...form, cert_date:e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>Expiry Date *</label>
                    <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date:e.target.value })} />
                  </div>
                </div>

                {/* Quantity + Period */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>Quantity (MT) *</label>
                    <input type="number" value={form.quantity_tonnes} min="0" step="0.01" placeholder="100"
                      onChange={e => setForm({ ...form, quantity_tonnes:e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>Filing Period *</label>
                    <select value={form.period} onChange={e => setForm({ ...form, period:e.target.value })}>
                      <option value="">Select...</option>
                      {PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
                    </select>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>
                    Upload Certificate PDF (optional)
                  </label>
                  <label style={{
                    display:'flex', alignItems:'center', gap:'12px', cursor:'pointer',
                    borderRadius:'10px', padding:'12px 16px',
                    border:'1px dashed var(--border)', background:'var(--surface2)',
                    transition:'border-color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                    <span style={{ fontSize:'20px' }}>📎</span>
                    <div>
                      {selectedFile ? (
                        <>
                          <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text)' }}>{selectedFile.name}</p>
                          <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{formatBytes(selectedFile.size)}</p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize:'13px', color:'var(--muted)' }}>Click to attach</p>
                          <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>PDF, JPG, PNG</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => setSelectedFile(e.target.files[0])} style={{ display:'none' }} />
                  </label>
                </div>

                {/* Error */}
                {formError && (
                  <div style={{
                    background:'rgba(239,68,68,0.1)', color:'var(--danger)',
                    border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px',
                    padding:'10px 14px', fontSize:'12px',
                  }}>
                    {formError}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display:'flex', gap:'12px' }}>
                  <button
                    onClick={() => { setShowForm(false); setFormError('') }}
                    style={{
                      flex:1, padding:'11px', borderRadius:'9px', fontSize:'13px', fontWeight:600,
                      background:'transparent', border:'1px solid var(--border)',
                      color:'var(--muted)', cursor:'pointer',
                    }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    style={{
                      flex:1, padding:'11px', borderRadius:'9px', fontSize:'13px', fontWeight:700,
                      background: submitting ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), #00a878)',
                      color: submitting ? 'var(--muted)' : '#000',
                      border: submitting ? '1px solid var(--border)' : 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}>
                    {submitting ? 'Saving...' : 'Save Certificate'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
