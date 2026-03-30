import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '11px 14px', fontSize: '13px',
  color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%',
}
const lbl = {
  fontSize: '11px', color: 'var(--muted)', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '7px',
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function reset() {
    setError(''); setMessage(''); setEmail(''); setPassword(''); setShowPassword(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else {
        setMessage('Account created! You can now log in.')
        setMode('login')
        setPassword('')
      }

    } else if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else {
        const { data: co } = await supabase
          .from('companies')
          .select('onboarding_complete')
          .eq('user_id', data.user.id)
          .single()
        navigate(co?.onboarding_complete ? '/dashboard' : '/onboarding')
      }

    } else if (mode === 'forgot') {
      // Check if user exists by attempting sign in with dummy password
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password: 'check-only-000',
      })

      const errMsg = checkError?.message?.toLowerCase() || ''
      // "invalid login credentials" = user exists but wrong password = safe to send reset
      const userExists = errMsg.includes('invalid login credentials')

      if (!userExists) {
        setError('No account found with this email. Please sign up first.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) setError(error.message)
        else setMessage('Password reset email sent! Check your inbox.')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 800, color: '#000',
          }}>♻</div>
          <p style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
            EPR Compliance Platform
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '32px', color: 'var(--text)', lineHeight: 1.1 }}>
            ComplianceOS
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
            Plastic Waste Management · India PWM Rules 2016
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px' }}>

          {mode === 'forgot' ? (
            <>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '6px' }}>
                Reset Password
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '28px' }}>
                Enter your registered email to receive a reset link.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={lbl}>Email Address</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" style={inp}
                  />
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                    {error}
                  </div>
                )}
                {message && (
                  <div style={{ background: 'rgba(0,200,150,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  padding: '13px', borderRadius: '9px', border: 'none', fontWeight: 700,
                  fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px',
                  background: loading ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), #00a878)',
                  color: loading ? 'var(--muted)' : '#000',
                }}>
                  {loading ? 'Checking...' : 'Send Reset Link'}
                </button>

                <button type="button" onClick={() => { setMode('login'); reset() }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                  ← Back to Login
                </button>
              </form>
            </>

          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '28px' }}>
                {[['login', 'Log In'], ['signup', 'Sign Up']].map(([m, label]) => (
                  <button key={m} onClick={() => { setMode(m); reset() }} style={{
                    flex: 1, padding: '9px', borderRadius: '7px', border: 'none',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--accent)' : 'var(--muted)',
                    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  }}>
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Email */}
                <div>
                  <label style={lbl}>Email Address</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" style={inp}
                  />
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Password</label>
                    {mode === 'login' && (
                      <button type="button"
                        onClick={() => { setMode('forgot'); reset() }}
                        style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent2)', cursor: 'pointer', fontWeight: 600 }}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ ...inp, paddingRight: '44px' }}
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                    {error}
                  </div>
                )}
                {message && (
                  <div style={{ background: 'rgba(0,200,150,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  padding: '13px', borderRadius: '9px', border: 'none', fontWeight: 700,
                  fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px',
                  background: loading ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), #00a878)',
                  color: loading ? 'var(--muted)' : '#000',
                }}>
                  {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
                </button>

              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', marginTop: '20px' }}>
          India PWM Rules 2016 · CPCB EPR Compliance
        </p>
      </div>
    </div>
  )
}