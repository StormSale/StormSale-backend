import { Router } from 'express';
import { ShortLinkController } from '../controllers/shortlink.controller';

const router = Router();
const shortLinkController = new ShortLinkController();

router.post('/', shortLinkController.createShortLink);
router.get('/:slug', shortLinkController.resolveShortLink);
router.get('/affiliate/:affiliateWallet', shortLinkController.getAffiliateLinks);

export default router;

