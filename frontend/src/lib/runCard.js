import { averageSpeed, formatDistance, formatPace, formatTime, getSplits } from './runStats'

const WIDTH = 1200
const HEIGHT = 1500
const TILE_SIZE = 256

function roundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
}

function project({ latitude, longitude }, zoom) {
  const boundedLatitude = Math.max(-85.0511, Math.min(85.0511, latitude))
  const worldSize = TILE_SIZE * 2 ** zoom
  const latitudeRadians = boundedLatitude * Math.PI / 180
  return {
    x: (longitude + 180) / 360 * worldSize,
    y: (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * worldSize,
  }
}

function extentForRoute(route, zoom) {
  const points = route.map((point) => project(point, zoom))
  if (!points.length) return { points, center: { x: TILE_SIZE * 2 ** zoom / 2, y: TILE_SIZE * 2 ** zoom / 2 }, width: 1000, height: 650 }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  let width = Math.max(...xs) - Math.min(...xs)
  let height = Math.max(...ys) - Math.min(...ys)
  if (points.length === 1 || (width < 8 && height < 8)) {
    width = 500
    height = 350
  }
  return {
    points,
    center: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
    width,
    height,
  }
}

function drawFallbackMap(context, x, y, width, height) {
  context.save()
  context.beginPath()
  context.rect(x, y, width, height)
  context.clip()
  context.fillStyle = '#e8eee4'
  context.fillRect(x, y, width, height)
  context.fillStyle = '#dce8d7'
  context.beginPath()
  context.ellipse(x + width * .22, y + height * .3, width * .19, height * .16, -.3, 0, Math.PI * 2)
  context.ellipse(x + width * .82, y + height * .78, width * .23, height * .18, .35, 0, Math.PI * 2)
  context.fill()

  const roads = [
    [[-.1, .24], [.2, .37], [.48, .32], [.72, .44], [1.1, .26]],
    [[-.05, .67], [.25, .6], [.49, .72], [.69, .62], [1.08, .78]],
    [[.18, -.1], [.3, .17], [.38, .46], [.33, .73], [.48, 1.1]],
    [[.68, -.1], [.58, .17], [.69, .41], [.82, .65], [.72, 1.1]],
    [[-.1, .48], [.21, .45], [.5, .53], [.76, .5], [1.1, .54]],
  ]
  for (const road of roads) {
    context.beginPath()
    road.forEach(([px, py], index) => {
      const pointX = x + px * width
      const pointY = y + py * height
      if (!index) context.moveTo(pointX, pointY)
      else context.lineTo(pointX, pointY)
    })
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.strokeStyle = '#fffdf6'
    context.lineWidth = 14
    context.stroke()
    context.strokeStyle = '#d4d9ce'
    context.lineWidth = 2
    context.stroke()
  }
  context.restore()
}

function loadTile(zoom, x, y) {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve({ image, x, y })
    image.onerror = () => resolve(null)
    image.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
  })
}

async function drawMap(context, route, panel) {
  const { x, y, width, height } = panel
  drawFallbackMap(context, x, y, width, height)
  let zoom = 16
  let extent = extentForRoute(route, zoom)
  let scale = Math.min((width - 75) / extent.width, (height - 75) / extent.height)
  for (; zoom > 10 && scale < .55; zoom -= 1) {
    extent = extentForRoute(route, zoom)
    scale = Math.min((width - 75) / extent.width, (height - 75) / extent.height)
  }
  for (; zoom < 19 && scale > 1.25; zoom += 1) {
    extent = extentForRoute(route, zoom)
    scale = Math.min((width - 75) / extent.width, (height - 75) / extent.height)
  }
  scale = Math.max(.35, Math.min(1.3, scale))
  const halfTilesX = Math.ceil(width / (TILE_SIZE * scale) / 2) + 1
  const halfTilesY = Math.ceil(height / (TILE_SIZE * scale) / 2) + 1
  const centerTileX = Math.floor(extent.center.x / TILE_SIZE)
  const centerTileY = Math.floor(extent.center.y / TILE_SIZE)
  const tileCount = 2 ** zoom
  const requests = []
  for (let tileY = centerTileY - halfTilesY; tileY <= centerTileY + halfTilesY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue
    for (let tileX = centerTileX - halfTilesX; tileX <= centerTileX + halfTilesX; tileX += 1) {
      const wrappedX = (tileX % tileCount + tileCount) % tileCount
      requests.push(loadTile(zoom, wrappedX, tileY).then((tile) => tile && ({ ...tile, worldX: tileX })))
    }
  }
  const tiles = await Promise.all(requests)
  const panelCenterX = x + width / 2
  const panelCenterY = y + height / 2
  for (const tile of tiles) {
    if (!tile) continue
    const tileX = panelCenterX + (tile.worldX * TILE_SIZE - extent.center.x) * scale
    const tileY = panelCenterY + (tile.y * TILE_SIZE - extent.center.y) * scale
    context.drawImage(tile.image, tileX, tileY, TILE_SIZE * scale + .5, TILE_SIZE * scale + .5)
  }

  context.save()
  context.beginPath()
  context.rect(x, y, width, height)
  context.clip()
  if (route.length) {
  const canvasSegments = []
    let canvasSegment = []
    route.forEach((point, index) => {
      if (point.breakBefore && canvasSegment.length) {
        canvasSegments.push(canvasSegment)
        canvasSegment = []
      }
      const projected = extent.points[index]
      canvasSegment.push({
        x: panelCenterX + (projected.x - extent.center.x) * scale,
        y: panelCenterY + (projected.y - extent.center.y) * scale,
      })
    })
    if (canvasSegment.length) canvasSegments.push(canvasSegment)
    const canvasPoints = canvasSegments.flat()
    for (const segment of canvasSegments) {
      if (segment.length < 2) continue
      context.beginPath()
      segment.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = 'rgba(255,255,255,.96)'
      context.lineWidth = 19
      context.stroke()
      context.strokeStyle = '#263f31'
      context.lineWidth = 13
      context.stroke()
      context.strokeStyle = '#d5f276'
      context.lineWidth = 7
      context.stroke()
    }
    drawMarker(context, canvasPoints[0], '#d5f276', '#293f32')
    if (canvasPoints.length > 1) drawMarker(context, canvasPoints.at(-1), '#293f32', '#fff')
  } else {
    context.fillStyle = 'rgba(34,52,41,.65)'
    context.font = '600 18px "DM Sans", sans-serif'
    context.textAlign = 'center'
    context.fillText('Route map', panelCenterX, panelCenterY)
  }
  context.restore()
  context.save()
  context.textAlign = 'right'
  context.font = '12px Arial, sans-serif'
  context.fillStyle = 'rgba(41,52,41,.74)'
  context.fillText('© OpenStreetMap contributors', x + width - 10, y + height - 10)
  context.restore()
}

function drawMarker(context, point, outer, inner) {
  context.beginPath()
  context.arc(point.x, point.y, 12, 0, Math.PI * 2)
  context.fillStyle = outer
  context.fill()
  context.beginPath()
  context.arc(point.x, point.y, 6, 0, Math.PI * 2)
  context.fillStyle = inner
  context.fill()
}

function drawPhoto(context, photo) {
  if (!photo) return
  const scale = Math.max(WIDTH / photo.width, HEIGHT / photo.height)
  const width = photo.width * scale
  const height = photo.height * scale
  context.drawImage(photo, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height)
  context.fillStyle = 'rgba(17, 29, 22, .45)'
  context.fillRect(0, 0, WIDTH, HEIGHT)
}

function drawStat(context, x, y, label, value, unit = '') {
  context.fillStyle = '#8a9488'
  context.font = '700 13px "DM Sans", sans-serif'
  context.textAlign = 'left'
  context.fillText(label, x, y)
  context.fillStyle = '#26382c'
  context.font = '700 38px "Manrope", sans-serif'
  context.fillText(value, x, y + 53)
  if (unit) {
    const valueWidth = context.measureText(value).width
    context.fillStyle = '#829079'
    context.font = '500 16px "DM Sans", sans-serif'
    context.fillText(unit, x + valueWidth + 9, y + 51)
  }
}

export async function createRunCard(run, photoFile = null) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  let photo = null
  if (photoFile) photo = await createImageBitmap(photoFile)

  context.fillStyle = '#eff1e9'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  if (photo) drawPhoto(context, photo)

  const inset = 52
  context.fillStyle = '#f8f9f5'
  context.fillRect(inset, inset, WIDTH - inset * 2, 173)
  context.fillStyle = '#253a2e'
  context.font = '800 22px "Manrope", sans-serif'
  context.textAlign = 'left'
  context.fillText('stride', inset + 28, inset + 39)
  context.fillStyle = '#95b73c'
  context.fillText('.', inset + 89, inset + 39)
  context.fillStyle = '#7d887b'
  context.font = '700 12px "DM Sans", sans-serif'
  context.fillText('YOUR RUN, YOUR ROUTE', inset + 28, inset + 75)
  context.fillStyle = '#25372c'
  context.font = '700 37px "Manrope", sans-serif'
  context.fillText('Run recap', inset + 28, inset + 123)
  const runDate = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(run.startedAt))
  context.fillStyle = '#768176'
  context.font = '500 15px "DM Sans", sans-serif'
  context.textAlign = 'right'
  context.fillText(runDate, WIDTH - inset - 28, inset + 123)

  const mapPanel = { x: inset, y: 250, width: WIDTH - inset * 2, height: 690 }
  roundedRect(context, mapPanel.x, mapPanel.y, mapPanel.width, mapPanel.height, 20, '#f9faf6')
  context.save()
  context.beginPath()
  context.roundRect(mapPanel.x + 10, mapPanel.y + 10, mapPanel.width - 20, mapPanel.height - 20, 13)
  context.clip()
  await drawMap(context, run.route || [], {
    x: mapPanel.x + 10,
    y: mapPanel.y + 10,
    width: mapPanel.width - 20,
    height: mapPanel.height - 20,
  })
  context.restore()
  context.fillStyle = 'rgba(249,250,246,.94)'
  roundedRect(context, mapPanel.x + 22, mapPanel.y + 22, 126, 34, 17, 'rgba(249,250,246,.92)')
  context.fillStyle = '#647454'
  context.textAlign = 'left'
  context.font = '700 11px "DM Sans", sans-serif'
  context.fillText('ROUTE MAP', mapPanel.x + 38, mapPanel.y + 44)

  const statsY = 970
  const statsHeight = 390
  roundedRect(context, inset, statsY, WIDTH - inset * 2, statsHeight, 18, '#f9faf6')
  context.fillStyle = '#899286'
  context.font = '700 12px "DM Sans", sans-serif'
  context.textAlign = 'left'
  context.fillText('THE NUMBERS', inset + 29, statsY + 35)
  const col1 = inset + 29
  const col2 = WIDTH / 2 + 15
  drawStat(context, col1, statsY + 78, 'DISTANCE', formatDistance(run.distanceMeters), 'km')
  drawStat(context, col2, statsY + 78, 'ELAPSED TIME', formatTime(run.durationSeconds))
  context.strokeStyle = '#e6e9e0'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(inset + 28, statsY + 206)
  context.lineTo(WIDTH - inset - 28, statsY + 206)
  context.stroke()
  drawStat(context, col1, statsY + 237, 'AVG. PACE', formatPace(run.distanceMeters, run.durationSeconds).replace(' /km', ''), '/km')
  drawStat(context, col2, statsY + 237, 'AVG. SPEED', averageSpeed(run.distanceMeters, run.durationSeconds).toFixed(1), 'km/h')

  const splits = getSplits(run.route || []).filter((split) => !split.partial).slice(0, 5)
  const splitText = splits.length ? splits.map((split) => `${split.kilometre}K ${formatTime(split.durationSeconds)}`).join('     ·     ') : 'One run at a time.'
  context.fillStyle = photo ? '#f1f3e8' : '#75816f'
  context.textAlign = 'center'
  context.font = '500 13px "DM Sans", sans-serif'
  context.fillText(splitText, WIDTH / 2, 1411, WIDTH - 100)
  context.fillStyle = photo ? '#edf0e7' : '#929b8d'
  context.font = '700 10px "DM Sans", sans-serif'
  context.fillText('MADE FOR THE MILES AHEAD  ·  STRIDE', WIDTH / 2, 1455)
  if (photo) photo.close()
  return canvas
}

export async function downloadRunCard(run, photoFile = null) {
  const canvas = await createRunCard(run, photoFile)
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
