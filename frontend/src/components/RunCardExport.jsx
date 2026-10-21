import { useEffect, useState } from 'react'
import { downloadRunCard } from '../lib/runCard'

export default function RunCardExport({ run }) {
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!previewUrl) return undefined
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function exportPng() {
    setBusy(true)
    setError('')
    try {
      await downloadRunCard(run, photo)
    } catch (exportError) {
      setError(exportError.message || 'Could not create the PNG. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="export-panel">
      <div className="export-copy"><span className="eyebrow">TAKE YOUR RUN WITH YOU</span><h2>Make a run card</h2><p>Your PNG includes the route map and your run stats. Add a photo for a personal backdrop; it stays on this device.</p></div>
      <div className="export-actions">
        <label className="photo-picker">{previewUrl ? <img src={previewUrl} alt="Selected photo preview" /> : <span aria-hidden="true">＋</span>}<span>{photo ? 'Change photo' : 'Add a photo'}</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] || null; setPhoto(file); setPreviewUrl(file ? URL.createObjectURL(file) : ''); event.target.value = '' }} /></label>
        {photo && <button className="remove-photo" onClick={() => { setPhoto(null); setPreviewUrl('') }}>Remove photo</button>}
        <button className="button button-dark export-button" onClick={exportPng} disabled={busy}>{busy ? 'Creating PNG…' : 'Download PNG'}<span>↓</span></button>
      </div>
      {error && <p className="inline-error export-error" role="alert">{error}</p>}
    </section>
  )
}
