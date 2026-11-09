import { Router } from 'express';
import { ReferralController } from '../controllers/referral.controller';

const router = Router();
const referralController = new ReferralController();

router.post('/', referralController.registerReferral);
router.get('/recruiter/:recruiterAddress', referralController.getRecruiterTree);
router.post('/commission-split', referralController.calculateCommissionSplit);
router.post('/record-sale', referralController.recordSale);

export default router;

