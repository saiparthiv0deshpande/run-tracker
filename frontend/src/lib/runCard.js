import { formatDistance, formatPace } from './runStats'

const WIDTH = 1080
const HEIGHT = 1920
const ROUTE_ZOOM = 16

function project({ latitude, longitude }, zoom) {
  const boundedLatitude = Math.max(-85.0511, Math.min(85.0511, latitude))
  const worldSize = 256 * 2 ** zoom
  const latitudeRadians = boundedLatitude * Math.PI / 180
  return {
    x: (longitude + 180) / 360 * worldSize,
    y: (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * worldSize,
  }
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours
    ? `${hours}h ${minutes}m ${remainder}s`
    : `${minutes}m ${remainder}s`
}

function drawCenteredText(context, text, y, font, color = '#fff') {
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.fillStyle = color
  context.fillText(text, WIDTH / 2, y)
}

function drawRoute(context, route) {
  const points = route
    .map((point) => ({ ...project(point, ROUTE_ZOOM), breakBefore: Boolean(point.breakBefore) }))
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
  if (points.length < 2) return

  const minX = Math.min(...points.map(({ x }) => x))
  const maxX = Math.max(...points.map(({ x }) => x))
  const minY = Math.min(...points.map(({ y }) => y))
  const maxY = Math.max(...points.map(({ y }) => y))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const routeArea = { x: 220, y: 1160, width: 640, height: 430 }
  const scale = Math.min(
    routeArea.width / Math.max(maxX - minX, 1),
    routeArea.height / Math.max(maxY - minY, 1),
  )

  context.save()
  context.beginPath()
  context.rect(routeArea.x, routeArea.y, routeArea.width, routeArea.height)
  context.clip()
  context.beginPath()
  points.forEach((point, index) => {
    const x = WIDTH / 2 + (point.x - centerX) * scale
    const y = (routeArea.y + routeArea.height / 2) + (point.y - centerY) * scale
    if (!index || point.breakBefore) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.strokeStyle = '#fc4c02'
  context.lineWidth = 12
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke()
  context.restore()
}

export async function createRunCard(run) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')

  const pace = formatPace(run.distanceMeters, run.durationSeconds)
    .replace(/^0(?=\d:)/, '')
  drawCenteredText(context, 'Distance', 96, '700 54px "DM Sans", sans-serif')
  drawCenteredText(context, `${formatDistance(run.distanceMeters)} km`, 264, '800 132px "Manrope", sans-serif')
  drawCenteredText(context, 'Pace', 465, '700 54px "DM Sans", sans-serif')
  drawCenteredText(context, pace, 630, '800 122px "Manrope", sans-serif')
  drawCenteredText(context, 'Time', 855, '700 54px "DM Sans", sans-serif')
  drawCenteredText(context, formatDuration(run.durationSeconds), 1020, '800 122px "Manrope", sans-serif')

  drawRoute(context, run.route || [])
  drawCenteredText(context, 'STRIDE', 1820, '800 72px "Manrope", sans-serif')

  return canvas
}

export async function downloadRunCard(run) {
  const canvas = await createRunCard(run)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((imageBlob) => imageBlob ? resolve(imageBlob) : reject(new Error('Could not create the PNG. Please try again.')), 'image/png')
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `stride-run-${new Date(run.startedAt).toISOString().slice(0, 10)}.png`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
