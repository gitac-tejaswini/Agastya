import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
]

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '11px 14px', fontSize: '13px',
  color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%',
}
const lbl = {
  fontSize: '11px', color: 'var(--muted)', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '7px',
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '', state: '', epr_reg_number: '',
    annual_target_tonnes: '', alert_email: user?.email || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          name: form.name,
          state: form.state,
          epr_reg_number: form.epr_reg_number || null,
          annual_target_tonnes: parseFloat(form.annual_target_tonnes),
          alert_email: form.alert_email,
          onboarding_complete: true
        })
        .select().single()

      if (companyError) throw companyError

      const { error: filingsError } = await supabase.from('filings').insert(
        ['Q1','Q2','Q3','Q4','Annual'].map(period => ({
          company_id: company.id, period,
          financial_year: '2025-26', status: 'Not started'
        }))
      )
      if (filingsError) throw filingsError
      navigate('/dashboard')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      background: 'var(--bg)',
      fontFamily: 'var(--sans)',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{
            fontSize: '10px', color: 'var(--accent)', letterSpacing: '2.5px',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            Agastya
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '26px', color: 'var(--text)', lineHeight: 1.1 }}>
           Company Profile Setup
          </h1>
        </div>

      
        {/* Form Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '28px 32px',
        }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '19px', color: 'var(--text)', marginBottom: '4px' }}>
            Company Information
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '24px' }}>
            One-time setup. Used for CPCB compliance reporting.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Company Name */}
            <div>
              <label style={lbl}>Company Name *</label>
              <input
                name="name" required value={form.name} onChange={handleChange}
                placeholder="Acme Plastics Pvt. Ltd." style={inp} />
            </div>

            {/* State */}
            <div>
              <label style={lbl}>State of Primary Operation *</label>
              <select name="state" required value={form.state} onChange={handleChange} style={inp}>
                <option value="">Select state...</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* EPR Reg No */}
            <div>
              <label style={lbl}>
                CPCB EPR Registration No.{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                name="epr_reg_number" value={form.epr_reg_number} onChange={handleChange}
                placeholder="EPR-MH-2024-XXXXX" style={inp} />
            </div>

            {/* Annual Target + Alert Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={lbl}>Annual EPR Target (MT) *</label>
                <input
                  type="number" name="annual_target_tonnes" required min="0" step="0.01"
                  value={form.annual_target_tonnes} onChange={handleChange}
                  placeholder="500" style={inp} />
              </div>
              <div>
                <label style={lbl}>Alert Email *</label>
                <input
                  type="email" name="alert_email" required value={form.alert_email}
                  onChange={handleChange} placeholder="compliance@co.com" style={inp} />
              </div>
            </div>


            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                padding: '10px 14px', fontSize: '12px',
              }}>
                {error}
              </div>
            )}

            {/* Submit — left-aligned, ~35% width */}
            <div style={{ paddingTop: '4px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 28px',
                  borderRadius: '9px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.4px',
                  background: loading
                    ? 'var(--surface2)'
                    : 'linear-gradient(135deg, var(--accent), #00a878)',
                  color: loading ? 'var(--muted)' : '#000',
                  whiteSpace: 'nowrap',
                }}>
                {loading ? 'Setting up...' : 'Save & Go to Dashboard →'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  )
}
