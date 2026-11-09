import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
const webhookController = new WebhookController();

router.post('/', webhookController.registerWebhook);
router.get('/organization/:orgId', webhookController.getOrganizationWebhooks);
router.post('/:id/test-ping', webhookController.sendTestPing);

export default router;

