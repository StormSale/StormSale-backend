import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.service';
import { z } from 'zod';

const campaignService = new CampaignService();

const createCampaignSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  tags: z.string(),
  onChainId: z.string(),
  advertiserWallet: z.string().regex(/^[GC][A-Z2-7]{55}$/, "Invalid Stellar account or contract address")
});

export class CampaignController {
  async createCampaign(req: Request, res: Response) {
    try {
      const parsed = createCampaignSchema.parse(req.body);
      const campaign = await campaignService.createCampaign(parsed);
      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as z.ZodError).errors });
         return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const campaign = await campaignService.getCampaign(id as string);
      
      if (!campaign) {
         res.status(404).json({ error: 'Campaign not found' });
         return;
      }
      
      res.status(200).json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async listCampaigns(req: Request, res: Response) {
    try {
      const campaigns = await campaignService.listCampaigns();
      res.status(200).json(campaigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
