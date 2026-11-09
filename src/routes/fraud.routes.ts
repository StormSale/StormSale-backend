import { Router } from 'express';
import { FraudController } from '../controllers/fraud.controller';

const router = Router();
const fraudController = new FraudController();

router.post('/eval', fraudController.evaluateRisk);
router.get('/affiliate/:affiliateAddress', fraudController.getProfile);
router.post('/affiliate/:affiliateAddress/pause', fraudController.setPauseStatus);

export default router;

