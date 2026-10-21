import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthDialog from './components/AuthDialog'
import RunCardExport from './components/RunCardExport'
import RunMap from './components/RunMap'
import useRunRecorder from './hooks/useRunRecorder'
import { api } from './lib/api'
import { averageSpeed, formatDistance, formatPace, formatTime, getSplits } from './lib/runStats'
import './App.css'

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 21c5-.3 8-3.2 11-8 1.5-2.5 3.8-3.7 6.5-3.7 1.7 0 3.3.7 4.5 1.8" /><circle cx="6" cy="21" r="2" /><circle cx="27" cy="11" r="2" /></svg></span>
}

function NavIcon({ type }) {
  const paths = {
    overview: <><path d="M4 13.5 16 4l12 9.5" /><path d="M7 12v14h18V12M12 26v-8h8v8" /></>,
    history: <><path d="M4 5v6h6" /><path d="M5.5 10a12 12 0 1 1-1 7" /><path d="M16 9v7l5 3" /></>,
    location: <><path d="M26 13c0 7-10 15-10 15S6 20 6 13a10 10 0 1 1 20 0Z" /><circle cx="16" cy="13" r="3" /></>,
    signout: <><path d="M13 5H6v22h7M20 10l6 6-6 6M26 16H12" /></>,
    arrow: <><path d="M7 16h18M18 8l8 8-8 8" /></>,
  }
  return <svg className="nav-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>
}

function App() {
  const recorder = useRunRecorder()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [view, setView] = useState('overview')
  const [runs, setRuns] = useState([])
  const [loadedRunsFor, setLoadedRunsFor] = useState(null)
  const [runsError, setRunsError] = useState('')
  const [selectedRun, setSelectedRun] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    let alive = true
    api('/api/auth/me')
      .then(({ user: currentUser }) => { if (alive) setUser(currentUser) })
      .catch(() => {})
      .finally(() => { if (alive) setAuthLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!user) {
      return undefined
    }
    let alive = true
    api('/api/runs')
      .then(({ runs: savedRuns }) => { if (alive) setRuns(savedRuns) })
      .catch((error) => { if (alive) setRunsError(error.message) })
      .finally(() => { if (alive) setLoadedRunsFor(user.id) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    const onInstallAvailable = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    return () => window.removeEventListener('beforeinstallprompt', onInstallAvailable)
  }, [])

  const onAuthenticated = useCallback((nextUser) => {
    setUser(nextUser)
    setRuns([])
    setLoadedRunsFor(null)
    setRunsError('')
    setAuthOpen(false)
    setSaveError('')
    setNotice(`Signed in as ${nextUser.name}.`)
    window.setTimeout(() => setNotice(''), 4200)
  }, [])

  const totalDistance = useMemo(() => runs.reduce((sum, run) => sum + (run.distanceMeters || 0), 0), [runs])
  const bestDistance = useMemo(() => runs.reduce((best, run) => Math.max(best, run.distanceMeters || 0), 0), [runs])
  const activeRoute = recorder.route
  const currentDistance = recorder.distanceMeters
  const activeSplits = useMemo(() => getSplits(activeRoute), [activeRoute])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  async function saveRun() {
    if (!recorder.draft) return
    if (!user) {
      setAuthOpen(true)
      setSaveError('Sign in to save this run to your account.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const { run } = await api('/api/runs', {
        method: 'POST',
        body: JSON.stringify(recorder.draft),
      })
      setRuns((previous) => [run, ...previous])
      setSelectedRun(run)
      setView('history')
      recorder.discard()
      setNotice('Run saved to your history.')
      window.setTimeout(() => setNotice(''), 4200)
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* Local sign-out still clears this screen. */ }
    setUser(null)
    setRuns([])
    setLoadedRunsFor(null)
    setRunsError('')
    setSelectedRun(null)
    setView('overview')
    setNotice('You have been signed out.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const displayName = user?.name?.split(' ')[0] || 'runner'
  const completedDate = recorder.draft ? new Date(recorder.draft.startedAt) : null
  const runsLoading = Boolean(user) && loadedRunsFor !== user.id

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={() => setView('overview')}><BrandMark /><span>stride<span className="brand-period">.</span></span></a>
        <div className="sidebar-label">MENU</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'nav-item selected' : 'nav-item'} onClick={() => { setView('overview'); setSelectedRun(null) }}><NavIcon type="overview" />Overview</button>
          <button className={view === 'history' ? 'nav-item selected' : 'nav-item'} onClick={() => setView('history')}><NavIcon type="history" />My runs<span className="nav-count">{runs.length || ''}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-mark">✳</div><strong>A little goes a long way.</strong><p>Show up, find your rhythm, and let the miles add up.</p></div>
          {user ? (
            <div className="profile-row">
              {user.pictureUrl ? <img src={user.pictureUrl} alt="" className="avatar" /> : <span className="avatar avatar-initial">{user.name?.charAt(0) || 'R'}</span>}
              <span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
              <button className="icon-button signout-button" onClick={signOut} aria-label="Sign out" title="Sign out"><NavIcon type="signout" /></button>
            </div>
          ) : (
            <button className="sidebar-signin" onClick={() => setAuthOpen(true)}>{authLoading ? 'Checking account…' : 'Sign in to save runs'}<NavIcon type="arrow" /></button>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <a className="mobile-brand" href="#home" onClick={() => setView('overview')}><BrandMark /><span>stride<span className="brand-period">.</span></span></a>
          <div className="topbar-right">
            <span className="live-label"><span className="live-dot" />{recorder.status === 'recording' ? 'RECORDING' : 'READY WHEN YOU ARE'}</span>
            {installPrompt && <button className="install-button" onClick={installApp}>Install app <span>↓</span></button>}
            {user ? <span className="topbar-user">{user.pictureUrl && <img src={user.pictureUrl} alt="" />}{user.name}</span> : <button className="topbar-signin" onClick={() => setAuthOpen(true)}>Sign in <span>↗</span></button>}
          </div>
        </header>

        <main className="page-content">
          {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {view === 'overview' ? (
            <>
              <section className="welcome-row">
                <div><div className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</div><h1>Ready for a run, {displayName}?</h1><p>Every run starts with showing up.</p></div>
                <div className="week-note"><span className="week-note-icon">↗</span><span><strong>{runs.length} {runs.length === 1 ? 'run' : 'runs'} logged</strong><small>Your progress, at your pace</small></span></div>
              </section>

              <section className="run-card" aria-label="Run recorder">
                <div className="run-card-heading">
                  <div><span className="eyebrow">YOUR NEXT MILE STARTS HERE</span><h2>{recorder.draft ? 'Run complete' : recorder.status === 'paused' ? 'Take your time' : recorder.status === 'recording' ? 'You’re on your way' : 'Find your pace'}</h2></div>
                  <span className={`recording-pill ${recorder.status === 'recording' ? 'is-recording' : ''}`}><span />{recorder.draft ? 'JUST FINISHED' : recorder.status === 'paused' ? 'PAUSED' : recorder.status === 'recording' ? 'RECORDING' : 'GPS READY'}</span>
                </div>
                <div className="run-card-grid">
                  <div className="run-map-column">
                    <RunMap route={recorder.draft?.route || activeRoute} />
                    <div className="map-caption"><span><NavIcon type="location" />{recorder.accuracy ? `GPS accuracy ±${recorder.accuracy} m` : 'GPS route map'}</span><span>KEEP APP IN FOREGROUND</span></div>
                  </div>
                  <div className="live-stats-panel">
                    <div className="distance-block"><span className="metric-label">DISTANCE</span><div className="distance-number">{formatDistance(recorder.draft?.distanceMeters ?? currentDistance)}<span>km</span></div></div>
                    <div className="timer-block"><span className="metric-label">ELAPSED TIME</span><div className="timer-number">{formatTime(recorder.draft?.durationSeconds ?? recorder.elapsedSeconds)}</div></div>
                    <div className="mini-stat-grid">
                      <div><span className="metric-label">AVG. PACE</span><strong>{formatPace(recorder.draft?.distanceMeters ?? currentDistance, recorder.draft?.durationSeconds ?? recorder.elapsedSeconds)}</strong></div>
                      <div><span className="metric-label">AVG. SPEED</span><strong>{(recorder.draft?.durationSeconds ?? recorder.elapsedSeconds) > 0 && (recorder.draft?.distanceMeters ?? currentDistance) > 0 ? `${averageSpeed(recorder.draft?.distanceMeters ?? currentDistance, recorder.draft?.durationSeconds ?? recorder.elapsedSeconds).toFixed(1)} km/h` : '—'}</strong></div>
                    </div>
                    {recorder.error && <p className="inline-error" role="alert">{recorder.error}</p>}
                    {saveError && <p className="inline-error" role="alert">{saveError}</p>}
                    {recorder.status === 'idle' && !recorder.draft ? (
                      <button className="button button-lime start-button" onClick={recorder.start} disabled={recorder.starting}><span className="button-play">▶</span>{recorder.starting ? 'Finding GPS…' : 'Start a run'}<span className="button-arrow">↗</span></button>
                    ) : recorder.status === 'recording' ? (
                      <div className="record-actions"><button className="button button-pause" onClick={recorder.pause}>Ⅱ <span>Pause</span></button><button className="finish-button" onClick={recorder.finish}>Finish run <span>■</span></button></div>
                    ) : recorder.status === 'paused' ? (
                      <div className="record-actions"><button className="button button-lime resume-button" onClick={recorder.resume} disabled={recorder.starting}><span className="button-play">▶</span>{recorder.starting ? 'Finding GPS…' : 'Resume'}</button><button className="finish-button" onClick={recorder.finish}>Finish run <span>■</span></button></div>
                    ) : (
                      <div className="record-actions"><button className="button button-lime save-button" onClick={saveRun} disabled={saving}>{saving ? 'Saving run…' : user ? 'Save to history' : 'Sign in to save'}<span>↗</span></button><button className="finish-button" onClick={recorder.discard}>Discard</button></div>
                    )}
                    <div className="foreground-note"><span>ⓘ</span><p>Keep Stride open while recording. Your browser may pause GPS if you switch apps or lock your screen.</p></div>
                  </div>
                </div>
              </section>

              {activeRoute.length > 1 && (
                <section className="splits-panel">
                  <div className="section-heading"><div><span className="eyebrow">PACE CHECK</span><h2>Kilometre splits</h2></div><span className="section-aside">{activeSplits.filter((split) => !split.partial).length} completed</span></div>
                  {activeSplits.length ? <div className="splits-list">{activeSplits.map((split) => <div className="split-row" key={split.kilometre}><span className="split-number">{String(split.kilometre).padStart(2, '0')}</span><span className="split-distance">KM {split.kilometre}{split.partial && <small> · {formatDistance(split.distanceMeters, 2)} km</small>}</span><strong>{formatTime(split.paceSecondsPerKm)}</strong><span className="split-bar"><i style={{ width: `${Math.max(24, Math.min(100, 100 - (split.paceSecondsPerKm - 300) / 5))}%` }} /></span></div>)}</div> : <p className="empty-copy">Your first split will appear at 1 km.</p>}
                </section>
              )}

              {recorder.draft && <RunCardExport run={recorder.draft} />}

              <section className="bottom-grid">
                <div className="summary-panel">
                  <div className="section-heading"><div><span className="eyebrow">YOUR JOURNEY SO FAR</span><h2>At a glance</h2></div><button className="text-link" onClick={() => setView('history')}>See your runs <span>↗</span></button></div>
                  <div className="summary-stats"><div><span>TOTAL DISTANCE</span><strong>{formatDistance(totalDistance, 1)}<small>km</small></strong></div><div><span>RUNS LOGGED</span><strong>{runs.length}</strong></div><div><span>LONGEST RUN</span><strong>{bestDistance ? formatDistance(bestDistance, 1) : '—'}<small>{bestDistance ? 'km' : ''}</small></strong></div></div>
                  {!runs.length && <p className="empty-copy">{user ? 'Your saved runs will show up here.' : 'Sign in to keep your running history across devices.'}</p>}
                </div>
                <div className="quote-panel"><div className="quote-mark">“</div><p>It never gets easier, you just get faster.</p><span>— GREG LE MOND</span><div className="quote-decoration">↗</div></div>
              </section>
            </>
          ) : (
            <section className="history-page">
              <div className="welcome-row history-welcome"><div><div className="eyebrow">EVERY STEP COUNTS</div><h1>Your running log</h1><p>A little farther, a little stronger, one run at a time.</p></div><div className="history-total"><strong>{formatDistance(totalDistance, 1)}<small> km</small></strong><span>TOTAL DISTANCE</span></div></div>
              {runsError && <p className="inline-error history-error" role="alert">{runsError}</p>}
              {runsLoading ? <div className="history-empty"><div className="loading-orbit" /><h2>Gathering your runs…</h2></div> : runs.length ? (
                <div className="history-layout">
                  <div className="history-list-panel"><div className="history-list-heading"><span>RUN</span><span>DISTANCE</span><span>TIME</span><span>PACE</span></div>
                    {runs.map((run) => <button key={run._id} className={`history-row ${selectedRun?._id === run._id ? 'history-row-active' : ''}`} onClick={() => setSelectedRun(run)}><span className="history-date"><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(run.startedAt))}</strong><small>{new Intl.DateTimeFormat('en', { weekday: 'short', year: 'numeric' }).format(new Date(run.startedAt))}</small></span><strong>{formatDistance(run.distanceMeters)} <small>km</small></strong><span>{formatTime(run.durationSeconds)}</span><span>{formatPace(run.distanceMeters, run.durationSeconds).replace(' /km', '')}</span></button>)}
                  </div>
                  <HistoryDetail run={selectedRun || runs[0]} />
                </div>
              ) : (
                <div className="history-empty"><span className="empty-route-icon">⌖</span><h2>{user ? 'Your first run is waiting.' : 'Sign in to see your running log.'}</h2><p>{user ? 'Start a run and save it to build your personal history.' : 'Your saved routes and stats will be ready as soon as you sign in.'}</p><button className="button button-lime" onClick={() => user ? setView('overview') : setAuthOpen(true)}>{user ? 'Start a run' : 'Sign in'}<span>↗</span></button></div>
              )}
            </section>
          )}
        </main>
        <footer className="footer"><span>STRIDE © {new Date().getFullYear()}</span><span>MADE FOR THE MILES AHEAD <i>✳</i></span></footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === 'overview' ? 'mobile-nav-active' : ''} onClick={() => { setView('overview'); setSelectedRun(null) }}><NavIcon type="overview" />Today</button><button className={view === 'history' ? 'mobile-nav-active' : ''} onClick={() => setView('history')}><NavIcon type="history" />My runs</button></nav>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSuccess={onAuthenticated} />}
      {completedDate && <span className="sr-only">Run completed {completedDate.toLocaleDateString()}</span>}
    </div>
  )
}

function HistoryDetail({ run }) {
  const splits = getSplits(run.route || []).filter((split) => !split.partial)
  return (
    <article className="history-detail">
      <div className="history-detail-top"><div><span className="eyebrow">RUN RECAP</span><h2>{new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date(run.startedAt))} run</h2></div><span className="detail-date">{new Intl.DateTimeFormat('en', { weekday: 'long', year: 'numeric' }).format(new Date(run.startedAt))}</span></div>
      <div className="history-detail-map"><RunMap route={run.route || []} /></div>
      <div className="history-detail-stats"><div><span>DISTANCE</span><strong>{formatDistance(run.distanceMeters)}<small>km</small></strong></div><div><span>TIME</span><strong>{formatTime(run.durationSeconds)}</strong></div><div><span>AVG. PACE</span><strong>{formatPace(run.distanceMeters, run.durationSeconds)}</strong></div><div><span>AVG. SPEED</span><strong>{averageSpeed(run.distanceMeters, run.durationSeconds).toFixed(1)}<small> km/h</small></strong></div></div>
      {splits.length > 0 && <div className="history-splits"><h3>Splits</h3>{splits.map((split) => <div className="history-split-row" key={split.kilometre}><span>KM {split.kilometre}</span><span>{formatTime(split.durationSeconds)}</span></div>)}</div>}
      <RunCardExport run={run} />
    </article>
  )
}

export default App
