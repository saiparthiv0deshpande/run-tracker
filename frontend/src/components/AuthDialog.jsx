import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function AuthDialog({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const googleButton = useRef(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined
    const renderGoogleButton = () => {
      if (!googleButton.current || !window.google?.accounts?.id) return
      googleButton.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setBusy(true)
          setError('')
          try {
            const result = await api('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential }),
            })
            onSuccess(result.user)
          } catch (googleError) {
            setError(googleError.message)
          } finally {
            setBusy(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleButton.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: mode === 'register' ? 'signup_with' : 'signin_with',
        width: 320,
      })
    }

    const existing = document.querySelector('script[data-google-identity]')
    if (window.google?.accounts?.id) {
      renderGoogleButton()
      return undefined
    }
    if (existing) {
      existing.addEventListener('load', renderGoogleButton)
      return () => existing.removeEventListener('load', renderGoogleButton)
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener('load', renderGoogleButton)
    document.head.appendChild(script)
    return () => script.removeEventListener('load', renderGoogleButton)
  }, [mode, onSuccess])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ ...(mode === 'register' ? { name } : {}), email, password }),
      })
      onSuccess(result.user)
    } catch (authError) {
      setError(authError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close sign in">×</button>
        <span className="eyebrow">YOUR RUNS, IN ONE PLACE</span>
        <h2 id="auth-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
        <p className="auth-subtitle">Save every route and find your running history whenever you need it.</p>
        {GOOGLE_CLIENT_ID && <div className="google-button" ref={googleButton} />}
        {GOOGLE_CLIENT_ID && <div className="auth-divider"><span>or continue with email</span></div>}
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
          )}
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' ? 8 : undefined} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark auth-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}<span aria-hidden="true">↗</span></button>
        </form>
        {!GOOGLE_CLIENT_ID && <p className="auth-note">Google sign-in is ready when `VITE_GOOGLE_CLIENT_ID` is configured.</p>}
        <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to Stride?'} <button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p>
      </section>
    </div>
  )
}
