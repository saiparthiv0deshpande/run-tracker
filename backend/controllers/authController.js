import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const googleClient = new OAuth2Client();

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    pictureUrl: user.pictureUrl || ''
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function register(request, response, next) {
  try {
    const name = String(request.body.name || '').trim();
    const email = normalizeEmail(request.body.email);
    const password = String(request.body.password || '');

    if (!name || !email || !password) {
      return response.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (name.length > 80 || email.length > 254) {
      return response.status(400).json({ message: 'Name or email is too long.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
    }

    const existingUser = await User.exists({ email });
    if (existingUser) {
      return response.status(409).json({ message: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    request.session.userId = user._id.toString();
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    const email = normalizeEmail(request.body.email);
    const password = String(request.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ message: 'Email or password is incorrect.' });
    }

    request.session.userId = user._id.toString();
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function googleLogin(request, response, next) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return response.status(503).json({ message: 'Google sign-in is not configured yet.' });
    }

    const credential = String(request.body.credential || '');
    if (!credential) {
      return response.status(400).json({ message: 'Google did not return a sign-in credential.' });
    }

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return response.status(401).json({ message: 'Google could not verify this email address.' });
    }

    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] }).select('+googleId');
    if (!user) {
      user = await User.create({
        name: payload.name || email.split('@')[0],
        email,
        googleId: payload.sub,
        pictureUrl: payload.picture || ''
      });
    } else {
      if (user.googleId && user.googleId !== payload.sub) {
        return response.status(409).json({ message: 'This email is linked to another Google account.' });
      }
      user.googleId = payload.sub;
      if (payload.name && !user.name) user.name = payload.name;
      if (payload.picture) user.pictureUrl = payload.picture;
      await user.save();
    }

    request.session.userId = user._id.toString();
    response.json({ user: publicUser(user) });
  } catch (error) {
    if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
      return response.status(401).json({ message: 'Google sign-in expired. Please try again.' });
    }
    next(error);
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await User.findById(request.session.userId);
    if (!user) return response.status(401).json({ message: 'Please sign in to continue.' });
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(request, response, next) {
  if (!request.session) return response.json({ ok: true });

  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie('stride.sid', {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    response.json({ ok: true });
  });
}
