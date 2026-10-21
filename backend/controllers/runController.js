import mongoose from 'mongoose';
import Run from '../models/Run.js';

const MAX_ROUTE_POINTS = 30000;

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanRoute(route) {
  if (!Array.isArray(route) || route.length > MAX_ROUTE_POINTS) return null;
  const points = [];
  for (const point of route) {
    if (!point || typeof point !== 'object') return null;
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    const elapsedSeconds = Number(point.elapsedSeconds);
    const distanceMeters = Number(point.distanceMeters);
    const recordedAt = parseDate(point.recordedAt);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0
      || !Number.isFinite(distanceMeters) || distanceMeters < 0 || !recordedAt) return null;
    points.push({ latitude, longitude, elapsedSeconds, distanceMeters, recordedAt, breakBefore: point.breakBefore === true });
  }
  return points;
}

export async function listRuns(request, response, next) {
  try {
    const runs = await Run.find({ userId: request.session.userId })
      .sort({ startedAt: -1 })
      .limit(100)
      .lean();
    response.json({ runs });
  } catch (error) {
    next(error);
  }
}

export async function createRun(request, response, next) {
  try {
    const { title = '', startedAt: startedAtValue, endedAt: endedAtValue } = request.body;
    const startedAt = parseDate(startedAtValue);
    const endedAt = parseDate(endedAtValue);
    const durationSeconds = Number(request.body.durationSeconds);
    const distanceMeters = Number(request.body.distanceMeters);
    const route = cleanRoute(request.body.route);

    if (!startedAt || !endedAt || endedAt < startedAt
      || !Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 48 * 60 * 60
      || !Number.isFinite(distanceMeters) || distanceMeters < 0 || distanceMeters > 1000000
      || route === null || String(title).length > 80) {
      return response.status(400).json({ message: 'Run details are invalid. Please try saving again.' });
    }

    const run = await Run.create({
      userId: new mongoose.Types.ObjectId(request.session.userId),
      title: String(title).trim(),
      startedAt,
      endedAt,
      durationSeconds: Math.round(durationSeconds),
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      route
    });
    response.status(201).json({ run });
  } catch (error) {
    next(error);
  }
}
