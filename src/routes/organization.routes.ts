import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';

const router = Router();
const organizationController = new OrganizationController();

router.post('/', organizationController.createOrganization);
router.get('/:id', organizationController.getOrganization);
router.get('/owner/:walletAddress', organizationController.listByOwner);
router.post('/:id/members', organizationController.addTeamMember);
router.get('/:id/members', organizationController.getTeamMembers);
router.delete('/:id/members/:memberId', organizationController.removeTeamMember);

export default router;

