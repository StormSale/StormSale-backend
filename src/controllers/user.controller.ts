import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { z } from 'zod';

const userService = new UserService();

const registerSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address"),
  role: z.enum(["ADVERTISER", "AFFILIATE", "AUDITOR"]).optional()
});

export class UserController {
  async registerOrLogin(req: Request, res: Response) {
    try {
      const parsed = registerSchema.parse(req.body);
      const user = await userService.findOrCreateUser(parsed.walletAddress, parsed.role);
      res.status(200).json(user);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as z.ZodError).errors });
         return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;
      const user = await userService.getUserProfile(walletAddress as string);
      
      if (!user) {
         res.status(404).json({ error: 'User not found' });
         return;
      }
      
      res.status(200).json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
