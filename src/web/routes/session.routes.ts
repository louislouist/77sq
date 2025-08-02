import { Router } from 'express';
import { getSessionsJson, getSessionsHtml } from '../controllers/session.controller';

const router = Router();

router.get('/', getSessionsJson);
router.get('/html', getSessionsHtml);

export default router;
