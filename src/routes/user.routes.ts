import { Router } from 'express';
import { UserController } from '../controllers/user.controller';

const router = Router();
const userController = new UserController();

router.post('/', userController.registerOrLogin);
router.get('/:walletAddress', userController.getProfile);

export default router;
