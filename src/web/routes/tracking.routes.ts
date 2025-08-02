import { Router } from 'express';
import { getTrackingInfo } from '../controllers/tracking.controller';

const router = Router();

router.get('/', getTrackingInfo);

export default router;
