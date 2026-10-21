export function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  const two = (value) => String(value).padStart(2, '0')
  return hours > 0 ? `${two(hours)}:${two(minutes)}:${two(remainder)}` : `${two(minutes)}:${two(remainder)}`
}

export function formatDistance(meters, digits = 2) {
  return ((Number(meters) || 0) / 1000).toFixed(digits)
}

export function paceSecondsPerKm(distanceMeters, durationSeconds) {
  return distanceMeters > 0 ? durationSeconds * 1000 / distanceMeters : 0
}

export function formatPace(distanceMeters, durationSeconds) {
  if (!distanceMeters) return '—:—'
  return `${formatTime(paceSecondsPerKm(distanceMeters, durationSeconds))} /km`
}

export function averageSpeed(distanceMeters, durationSeconds) {
  return durationSeconds > 0 ? distanceMeters / 1000 / (durationSeconds / 3600) : 0
}

export function getSplits(route = []) {
  const splits = []
  let splitStartSeconds = 0
  let nextMarker = 1000
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]
    const current = route[index]
    while (current.distanceMeters >= nextMarker && current.distanceMeters > previous.distanceMeters) {
      const ratio = (nextMarker - previous.distanceMeters) / (current.distanceMeters - previous.distanceMeters)
      const splitEndSeconds = previous.elapsedSeconds + ratio * (current.elapsedSeconds - previous.elapsedSeconds)
      splits.push({
        kilometre: splits.length + 1,
        durationSeconds: splitEndSeconds - splitStartSeconds,
        paceSecondsPerKm: splitEndSeconds - splitStartSeconds,
        partial: false,
      })
      splitStartSeconds = splitEndSeconds
      nextMarker += 1000
    }
  }
  const last = route.at(-1)
  const partialDistance = last?.distanceMeters - splits.length * 1000
  if (last && partialDistance > 25) {
    const durationSeconds = Math.max(0, last.elapsedSeconds - splitStartSeconds)
    splits.push({
      kilometre: splits.length + 1,
      distanceMeters: partialDistance,
      durationSeconds,
      paceSecondsPerKm: durationSeconds * 1000 / partialDistance,
      partial: true,
    })
  }
  return splits
}

export function haversineMeters(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
      * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
