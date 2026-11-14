import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { CampaignController } from '../controllers/campaign.controller';

const router = Router();
const organizationController = new OrganizationController();
const campaignController = new CampaignController();

router.post('/', organizationController.createOrganization);
router.get('/:id', organizationController.getOrganization);
router.get('/owner/:walletAddress', organizationController.listByOwner);
router.post('/:id/members', organizationController.addTeamMember);
router.get('/:id/members', organizationController.getTeamMembers);
router.delete('/:id/members/:memberId', organizationController.removeTeamMember);
router.post('/:id/campaigns/:campaignId/operator', campaignController.delegateCampaignOperator);
router.get('/:id/operator-audit-logs', organizationController.getOperatorAuditLogs);

export default router;

