import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { createRun, listRuns } from '../controllers/runController.js';

const router = Router();

router.use(requireUser);
router.get('/', listRuns);
router.post('/', createRun);

export default router;
