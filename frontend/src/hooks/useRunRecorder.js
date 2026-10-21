import { useCallback, useEffect, useRef, useState } from 'react'
import { haversineMeters } from '../lib/runStats'

export default function useRunRecorder() {
  const [status, setStatus] = useState('idle')
  const [route, setRoute] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [accuracy, setAccuracy] = useState(null)
  const [draft, setDraft] = useState(null)
  const statusRef = useRef('idle')
  const routeRef = useRef([])
  const distanceRef = useRef(0)
  const startedAtRef = useRef(null)
  const pausedMsRef = useRef(0)
  const pauseStartedAtRef = useRef(null)
  const pausedSecondsRef = useRef(0)
  const previousPositionRef = useRef(null)
  const breakNextPointRef = useRef(false)
  const watchIdRef = useRef(null)
  const wakeLockRef = useRef(null)

  const setRunStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const elapsedAt = useCallback((now = Date.now()) => {
    if (!startedAtRef.current) return 0
    if (statusRef.current === 'paused') return pausedSecondsRef.current
    return Math.max(0, (now - startedAtRef.current - pausedMsRef.current) / 1000)
  }, [])

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      // Screen wake lock is optional; GPS recording continues without it.
    }
  }, [])

  const onPosition = useCallback((position) => {
    const { latitude, longitude, accuracy: positionAccuracy } = position.coords
    setAccuracy(Math.round(positionAccuracy))
    if (positionAccuracy > 60) return
    const now = Date.now()
    const elapsed = elapsedAt(now)
    const next = { latitude, longitude }
    const previous = previousPositionRef.current
    let nextDistance = distanceRef.current

    if (!previous) {
      previousPositionRef.current = next
    } else {
      const step = haversineMeters(previous, next)
      if (step < 1.5) return
      if (step > 80 && elapsed - (routeRef.current.at(-1)?.elapsedSeconds || 0) < 15) return
      nextDistance += step
      distanceRef.current = nextDistance
      previousPositionRef.current = next
    }

    const lastPoint = routeRef.current.at(-1)
    if (lastPoint && elapsed - lastPoint.elapsedSeconds < 2 && nextDistance === lastPoint.distanceMeters) return
    const point = {
      latitude,
      longitude,
      recordedAt: new Date(position.timestamp || now).toISOString(),
      elapsedSeconds: elapsed,
      distanceMeters: nextDistance,
      breakBefore: breakNextPointRef.current,
    }
    breakNextPointRef.current = false
    const nextRoute = [...routeRef.current, point]
    routeRef.current = nextRoute
    setRoute(nextRoute)
  }, [elapsedAt])

  const onPositionError = useCallback((geoError) => {
    const messages = {
      1: 'Allow location access in your browser settings, then try again.',
      2: 'Your location is unavailable. Move somewhere with a clearer GPS signal.',
      3: 'Finding your location took too long. Try starting again.',
    }
    setError(messages[geoError.code] || 'Stride could not read your location.')
    clearWatch()
    releaseWakeLock()
    if (routeRef.current.length > 0) {
      pausedSecondsRef.current = elapsedAt()
      pauseStartedAtRef.current = Date.now()
      setElapsedSeconds(pausedSecondsRef.current)
      breakNextPointRef.current = true
      setRunStatus('paused')
    } else {
      setRunStatus('idle')
    }
    setStarting(false)
  }, [clearWatch, elapsedAt, releaseWakeLock, setRunStatus])

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('This browser does not support GPS location tracking.')
      setRunStatus('idle')
      setStarting(false)
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    })
    requestWakeLock()
  }, [onPosition, onPositionError, requestWakeLock, setRunStatus])

  const start = useCallback(() => {
    setError('')
    setStarting(true)
    const now = Date.now()
    routeRef.current = []
    distanceRef.current = 0
    previousPositionRef.current = null
    breakNextPointRef.current = false
    pausedMsRef.current = 0
    pausedSecondsRef.current = 0
    startedAtRef.current = now
    pauseStartedAtRef.current = null
    setAccuracy(null)
    setRoute([])
    setElapsedSeconds(0)
    setDraft(null)
    setRunStatus('recording')
    startWatch()
  }, [setRunStatus, startWatch])

  const pause = useCallback(() => {
    pausedSecondsRef.current = elapsedAt()
    pauseStartedAtRef.current = Date.now()
    previousPositionRef.current = null
    breakNextPointRef.current = true
    clearWatch()
    releaseWakeLock()
    setStarting(false)
    setElapsedSeconds(pausedSecondsRef.current)
    setRunStatus('paused')
  }, [clearWatch, elapsedAt, releaseWakeLock, setRunStatus])

  const resume = useCallback(() => {
    setError('')
    previousPositionRef.current = null
    breakNextPointRef.current = true
    if (pauseStartedAtRef.current) pausedMsRef.current += Date.now() - pauseStartedAtRef.current
    pauseStartedAtRef.current = null
    setStarting(true)
    setRunStatus('recording')
    startWatch()
  }, [setRunStatus, startWatch])

  const finish = useCallback(() => {
    const finishedAt = new Date()
    const durationSeconds = Math.floor(elapsedAt(finishedAt.getTime()))
    clearWatch()
    releaseWakeLock()
    const completed = {
      startedAt: new Date(startedAtRef.current || finishedAt).toISOString(),
      endedAt: finishedAt.toISOString(),
      durationSeconds,
      distanceMeters: distanceRef.current,
      route: routeRef.current,
    }
    setDraft(completed)
    setElapsedSeconds(durationSeconds)
    setRunStatus('idle')
    setStarting(false)
    setError('')
    return completed
  }, [clearWatch, elapsedAt, releaseWakeLock, setRunStatus])

  const discard = useCallback(() => {
    setDraft(null)
    routeRef.current = []
    distanceRef.current = 0
    startedAtRef.current = null
    pausedMsRef.current = 0
    pauseStartedAtRef.current = null
    pausedSecondsRef.current = 0
    setRoute([])
    setElapsedSeconds(0)
  }, [])

  useEffect(() => {
    if (status !== 'recording') return undefined
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor(elapsedAt()))
      setStarting(false)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [elapsedAt, status])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'recording') requestWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [requestWakeLock])

  useEffect(() => () => {
    clearWatch()
    releaseWakeLock()
  }, [clearWatch, releaseWakeLock])

  return {
    status,
    route,
    elapsedSeconds,
    distanceMeters: route.at(-1)?.distanceMeters || 0,
    error,
    starting,
    accuracy,
    draft,
    start,
    pause,
    resume,
    finish,
    discard,
  }
}
