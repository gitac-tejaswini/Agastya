import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const DOC_TYPES = ['Recycler Certificate','Purchase Invoice','CA Certified Quantity Report','SPCB Acknowledgment','Other']
const PERIODS = ['Q1','Q2','Q3','Q4','Annual']
const PERIOD_LABELS = { Q1:'Q1 (Apr–Jun)', Q2:'Q2 (Jul–Sep)', Q3:'Q3 (Oct–Dec)', Q4:'Q4 (Jan–Mar)', Annual:'Annual' }

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}
function formatBytes(b) {
  if (!b) return ''
  if (b < 1024*1024) return (b/1024).toFixed(1)+' KB'
  return (b/(1024*1024)).toFixed(1)+' MB'
}

export default function Documents() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [filings, setFilings] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterPeriod, setFilterPeriod] = useState('All')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [form, setForm] = useState({ doc_type:'', period:'', notes:'' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => { loadAll() }, [user])

  async function loadAll() {
    const { data: comp } = await supabase.from('companies').select('*').eq('user_id', user.id).single()
    if (!comp) return
    setCompany(comp)
    const { data: f } = await supabase.from('filings').select('*').eq('company_id', comp.id).eq('financial_year','2025-26')
    setFilings(f || [])
    await loadDocuments(comp.id)
    setLoading(false)
  }

  async function loadDocuments(companyId) {
    const { data } = await supabase.from('documents').select('*').eq('company_id', companyId).order('uploaded_at', { ascending: false })
    setDocuments(data || [])
  }

 async function handleUpload() {
  if (!selectedFile) return setUploadError('Please select a file.')
  if (!form.doc_type) return setUploadError('Please select a document type.')
  if (!form.period) return setUploadError('Please select a filing period.')

  setUploading(true)
  setUploadError('')

  try {
    // 1. Upload file to storage
    const filePath = `${company.id}/${Date.now()}_${selectedFile.name}`

    const { error: se } = await supabase.storage
      .from('documents')
      .upload(filePath, selectedFile)

    if (se) throw se

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    const filing = filings.find(f => f.period === form.period)

    // 2. Insert into documents table
    const { error: de } = await supabase.from('documents').insert({
      company_id: company.id,
      filing_id: filing?.id || null,
      file_url: urlData.publicUrl,
      file_name: selectedFile.name,
      doc_type: form.doc_type,
      notes: form.notes || null,
      uploader_email: user.email,
    })

    if (de) throw de

    // 3. AUTO CREATE RECYCLER CERTIFICATE (CORE LOGIC)
    if (form.doc_type === 'Recycler Certificate') {
      const recyclerName = selectedFile.name.split('.')[0]
      const { error: rcError } = await supabase
        .from('recycler_certificates')
        .insert({
          company_id: company.id,
          filing_id: filing?.id || null,

          recycler_name: recyclerName, // basic fallback
          cpcb_reg_no: 'AUTO-GENERATED', // can improve later

          cert_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            .toISOString()
            .split('T')[0],

          quantity_tonnes: 0, // user can update later
          file_url: urlData.publicUrl,
        })

      if (rcError) throw rcError
    }
    // Reset UI
    setShowUpload(false)
    setSelectedFile(null)
    setForm({ doc_type: '', period: '', notes: '' })

    await loadDocuments(company.id)

  } catch (err) {
    setUploadError(err.message)
  }

  setUploading(false)
}

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    const filePath = doc.file_url.split('/documents/')[1]
    await supabase.storage.from('documents').remove([filePath])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  const filtered = filterPeriod === 'All' ? documents
    : documents.filter(d => filings.find(f => f.id === d.filing_id)?.period === filterPeriod)

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px' }}>
        <p style={{ color:'var(--muted)' }}>Loading...</p>
      </div>
    </Layout>
  )

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px' }

  // Period breakdown counts for sidebar
  const periodCounts = PERIODS.map(p => ({
    label: PERIOD_LABELS[p],
    count: documents.filter(d => filings.find(f => f.id === d.filing_id)?.period === p).length,
  }))

  return (
    <Layout>
      <div style={{ maxWidth:'1140px', margin:'0 auto' }}>

        {/* Page Header — matches Dashboard */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px' }}>
            <div>
            <p style={{ fontSize:'11px', color:'var(--accent)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>
              Document Vault
            </p>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'28px', color:'var(--text)', lineHeight:1.1 }}>
              {documents.length} Document{documents.length !== 1 ? 's' : ''} Uploaded
            </h1>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>
              {company?.name} · FY 2025–26
            </p>
          </div>
          <button
            onClick={() => { setShowUpload(true); setUploadError('') }}
            style={{
             background:'var(--accent2)', color:'#fff',
             fontWeight:700, fontSize:'12px', padding:'10px 20px', borderRadius:'9px',
             border:'none', cursor:'pointer', letterSpacing:'0.5px', marginTop:'4px',
        }}>
          Upload
          </button>
        </div>

        {/* Main Grid — matches Dashboard's 1fr 300px layout */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px', alignItems:'start' }}>

          {/* Left Column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* Period Filter */}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {['All', ...PERIODS].map(p => (
                <button key={p} onClick={() => setFilterPeriod(p)}
                  style={{
                    padding:'5px 16px', borderRadius:'20px', fontSize:'11px', fontWeight:600,
                    cursor:'pointer', border:'1px solid', transition:'all 0.15s',
                    background: filterPeriod === p ? 'rgba(0,200,150,0.1)' : 'transparent',
                    color: filterPeriod === p ? 'var(--accent)' : 'var(--muted)',
                    borderColor: filterPeriod === p ? 'rgba(0,200,150,0.3)' : 'var(--border)',
                  }}>
                  {p === 'All' ? 'All Periods' : PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Document List Card */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 24px', textAlign:'center' }}>
                  <span style={{ fontSize:'48px', marginBottom:'16px' }}>📁</span>
                  <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text)', marginBottom:'6px' }}>No documents yet</p>
                  <p style={{ fontSize:'12px', color:'var(--muted)' }}>Upload your first document above</p>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)' }}>
                      {['File', 'Type', 'Period', 'Uploaded', 'Actions'].map(h => (
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
                    {filtered.map((doc, i) => {
                      const filing = filings.find(f => f.id === doc.filing_id)
                      return (
                        <tr key={doc.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding:'14px 18px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                              <span style={{ fontSize:'18px' }}>{doc.file_name?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                              <div>
                                <p style={{ color:'var(--text)', fontWeight:500, fontSize:'12px', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {doc.file_name}
                                </p>
                                {doc.notes && (
                                  <p style={{ color:'var(--muted)', fontSize:'11px', marginTop:'2px' }}>{doc.notes}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'14px 18px' }}>
                            <span style={{
                              background:'rgba(0,153,255,0.1)', color:'var(--accent2)',
                              border:'1px solid rgba(0,153,255,0.2)', padding:'3px 8px',
                              borderRadius:'4px', fontSize:'11px', fontWeight:600,
                            }}>
                              {doc.doc_type}
                            </span>
                          </td>
                          <td style={{ padding:'14px 18px', color:'var(--muted)', fontSize:'12px' }}>
                            {filing ? PERIOD_LABELS[filing.period] : '—'}
                          </td>
                          <td style={{ padding:'14px 18px', color:'var(--muted)', fontSize:'11px' }}>
                            {formatDate(doc.uploaded_at)}
                          </td>
                          <td style={{ padding:'14px 18px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                              <button onClick={() => window.open(doc.file_url, '_blank')}
                                style={{ color:'var(--accent2)', fontSize:'11px', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                ↓ View
                              </button>
                              <button onClick={() => handleDelete(doc)}
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

            {/* Upload Stats */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                Upload Summary
              </p>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <p style={{ fontFamily:'var(--serif)', fontSize:'48px', color:'var(--accent2)', lineHeight:1 }}>
                  {documents.length}
                </p>
                <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px' }}>total files</p>
              </div>
              {/* Progress toward 8-doc target for compliance score */}
              <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', marginBottom:'10px', overflow:'hidden' }}>
                <div style={{
                  height:'6px', borderRadius:'3px',
                  width:`${Math.min((documents.length / 8) * 100, 100)}%`,
                  background:'linear-gradient(90deg, var(--accent2), var(--accent))',
                  transition:'width 0.6s ease',
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--muted)' }}>
                <span>{documents.length} uploaded</span>
                <span>8 for full score</span>
              </div>
            </div>

            {/* By Period breakdown */}
            <div style={card}>
              <p style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'16px' }}>
                By Period
              </p>
              {periodCounts.map((p, i) => (
                <div key={p.label} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 0',
                  borderBottom: i < periodCounts.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize:'12px', color:'var(--muted)' }}>{p.label}</span>
                  <span style={{
                    fontSize:'11px', fontWeight:700, padding:'2px 10px', borderRadius:'20px',
                    background: p.count > 0 ? 'rgba(0,200,150,0.1)' : 'transparent',
                    color: p.count > 0 ? 'var(--accent)' : 'var(--muted)',
                    border: `1px solid ${p.count > 0 ? 'rgba(0,200,150,0.25)' : 'var(--border)'}`,
                  }}>
                    {p.count} file{p.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div style={{
            position:'fixed', inset:0, zIndex:50,
            display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
            background:'rgba(0,0,0,0.7)',
          }}>
            <div style={{
              width:'100%', maxWidth:'440px', borderRadius:'16px', padding:'28px',
              background:'var(--surface)', border:'1px solid var(--border)',
            }}>
              {/* Modal Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
                <div>
                  <p style={{ fontSize:'11px', color:'var(--accent)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>Document Vault</p>
                  <h2 style={{ fontFamily:'var(--serif)', color:'var(--text)', fontSize:'20px' }}>Upload Document</h2>
                </div>
                <button
                  onClick={() => { setShowUpload(false); setSelectedFile(null); setForm({ doc_type:'', period:'', notes:'' }) }}
                  style={{ color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>
                  ✕
                </button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* File Picker */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>
                    Select File *
                  </label>
                  <label style={{
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    padding:'24px 16px', cursor:'pointer', borderRadius:'10px',
                    border:'2px dashed var(--border)', background:'var(--surface2)',
                    transition:'border-color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    {selectedFile ? (
                      <div style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'32px' }}>{selectedFile.name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                        <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text)', marginTop:'8px' }}>{selectedFile.name}</p>
                        <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{formatBytes(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'32px' }}>📎</span>
                        <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'8px' }}>Click to select file</p>
                        <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>PDF, JPG, PNG accepted</p>
                      </div>
                    )}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { setSelectedFile(e.target.files[0]); setUploadError('') }}
                      style={{ display:'none' }} />
                  </label>
                </div>

                {/* Document Type */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>
                    Document Type *
                  </label>
                  <select value={form.doc_type} onChange={e => setForm({ ...form, doc_type:e.target.value })}>
                    <option value="">Select type...</option>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Filing Period */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>
                    Filing Period *
                  </label>
                  <select value={form.period} onChange={e => setForm({ ...form, period:e.target.value })}>
                    <option value="">Select period...</option>
                    {PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ fontSize:'11px', color:'var(--muted)', fontWeight:500, display:'block', marginBottom:'6px' }}>
                    Notes (optional)
                  </label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })}
                    placeholder="Any notes..." rows={2} style={{ resize:'none' }} />
                </div>

                {/* Error */}
                {uploadError && (
                  <div style={{
                    background:'rgba(239,68,68,0.1)', color:'var(--danger)',
                    border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px',
                    padding:'10px 14px', fontSize:'12px',
                  }}>
                    {uploadError}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display:'flex', gap:'12px' }}>
                  <button
                    onClick={() => { setShowUpload(false); setSelectedFile(null); setForm({ doc_type:'', period:'', notes:'' }) }}
                    style={{
                      flex:1, padding:'11px', borderRadius:'9px', fontSize:'13px', fontWeight:600,
                      background:'transparent', border:'1px solid var(--border)',
                      color:'var(--muted)', cursor:'pointer',
                    }}>
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={uploading}
                    style={{
                      flex:1, padding:'11px', borderRadius:'9px', fontSize:'13px', fontWeight:700,
                      background: uploading ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), #00a878)',
                      color: uploading ? 'var(--muted)' : '#000',
                      border: uploading ? '1px solid var(--border)' : 'none',
                      cursor: uploading ? 'not-allowed' : 'pointer',
                    }}>
                    {uploading ? 'Uploading...' : 'Save Document'}
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
