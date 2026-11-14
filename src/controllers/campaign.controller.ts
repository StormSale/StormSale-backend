import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.service';
import {
  OperatorDelegationError,
  OrganizationService,
} from '../services/organization.service';
import { z } from 'zod';

const campaignService = new CampaignService();
const organizationService = new OrganizationService();

const stellarWalletRegex = /^G[A-Z2-7]{55}$/;

const delegateOperatorSchema = z
  .object({
    operatorAddress: z.string().regex(stellarWalletRegex, "Invalid Stellar operator wallet address").optional(),
    operatorWallet: z.string().regex(stellarWalletRegex, "Invalid Stellar operator wallet address").optional(),
    nominatedBy: z.string().regex(stellarWalletRegex, "Invalid Stellar nominator wallet address").optional(),
    enabled: z.boolean().optional(),
  })
  .refine((val) => Boolean(val.operatorAddress || val.operatorWallet), {
    message: "operatorAddress is required",
    path: ["operatorAddress"],
  });

const createCampaignSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  tags: z.string(),
  onChainId: z.string(),
  advertiserWallet: z.string().regex(/^[GC][A-Z2-7]{55}$/, "Invalid Stellar account or contract address"),
  audience: z.enum(["B2B", "B2C"]).optional(),
  budget: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  commissionRate: z.number().positive().max(100).optional(),
  clearingPeriod: z.number().int().positive().optional(),
  organizationId: z.string().uuid().or(z.string().min(3)).optional()
});

export class CampaignController {
  async createCampaign(req: Request, res: Response) {
    try {
      const parsed = createCampaignSchema.parse(req.body);
      const campaign = await campaignService.createCampaign(parsed);
      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
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
      const { audience, organizationId } = req.query;
      const filters: any = {};
      if (audience === 'B2B' || audience === 'B2C') filters.audience = audience;
      if (typeof organizationId === 'string') filters.organizationId = organizationId;

      const campaigns = await campaignService.listCampaigns(filters);
      res.status(200).json(campaigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delegateCampaignOperator(req: Request, res: Response) {
    try {
      const { id: organizationId, campaignId } = req.params;
      const parsed = delegateOperatorSchema.parse(req.body);
      const operatorAddress = (parsed.operatorAddress || parsed.operatorWallet) as string;

      const result = await organizationService.nominateCampaignOperator({
        organizationId: organizationId as string,
        campaignId: campaignId as string,
        operatorAddress,
        nominatedBy: parsed.nominatedBy,
        enabled: parsed.enabled,
      });

      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues });
        return;
      }
      if (error instanceof OperatorDelegationError) {
        res.status(error.statusCode).json({ error: error.message, code: error.code });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ error: message });
    }
  }
}
