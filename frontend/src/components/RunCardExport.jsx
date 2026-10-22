import { useState } from 'react'
import { downloadRunCard } from '../lib/runCard'

export default function RunCardExport({ run }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function exportPng() {
    setBusy(true)
    setError('')
    try {
      await downloadRunCard(run)
    } catch (exportError) {
      setError(exportError.message || 'Could not create the PNG. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="export-panel">
      <div className="export-copy"><span className="eyebrow">TAKE YOUR RUN WITH YOU</span><h2>Make a story overlay</h2><p>Download a transparent PNG with your run stats, orange route, and STRIDE mark. Add it over a photo in your story editor.</p></div>
      <div className="export-actions">
        <button className="button button-dark export-button" onClick={exportPng} disabled={busy}>{busy ? 'Creating PNG…' : 'Download overlay PNG'}<span>↓</span></button>
      </div>
      {error && <p className="inline-error export-error" role="alert">{error}</p>}
    </section>
  )
}
