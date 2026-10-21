import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import {
  getCurrentUser,
  googleLogin,
  login,
  logout,
  register
} from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', requireUser, getCurrentUser);
router.post('/logout', logout);

export default router;
