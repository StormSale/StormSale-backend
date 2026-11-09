import { Request, Response } from 'express';
import { ReferralService } from '../services/referral.service';
import { z } from 'zod';

const referralService = new ReferralService();

const registerReferralSchema = z.object({
  recruiterAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar recruiter address"),
  childAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar sub-affiliate address"),
  tier: z.number().int().min(1).max(2).optional(),
  overrideRatePercent: z.number().min(0).max(50).optional(),
  directCommissionRatePercent: z.number().min(0).max(100).optional()
});

const calculateSplitSchema = z.object({
  saleAmountXlm: z.number().positive(),
  totalCommissionRatePercent: z.number().positive().max(100),
  sellingAffiliateAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar seller address"),
  recruiterAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar recruiter address").optional(),
  overrideRatePercent: z.number().min(0).max(50).optional()
});

const recordSaleSchema = z.object({
  childAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar child address"),
  saleAmountXlm: z.number().positive(),
  overrideEarnedXlm: z.number().nonnegative()
});

export class ReferralController {
  async registerReferral(req: Request, res: Response) {
    try {
      const parsed = registerReferralSchema.parse(req.body);
      const relation = await referralService.registerReferral(parsed);
      res.status(201).json(relation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async getRecruiterTree(req: Request, res: Response) {
    try {
      const { recruiterAddress } = req.params;
      const tree = await referralService.getRecruiterTree(recruiterAddress as string);
      res.status(200).json(tree);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async calculateCommissionSplit(req: Request, res: Response) {
    try {
      const parsed = calculateSplitSchema.parse(req.body);
      const split = referralService.calculateCommissionSplit(parsed);
      res.status(200).json(split);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async recordSale(req: Request, res: Response) {
    try {
      const parsed = recordSaleSchema.parse(req.body);
      const updated = await referralService.recordSale(
        parsed.childAddress,
        parsed.saleAmountXlm,
        parsed.overrideEarnedXlm
      );
      if (!updated) {
        res.status(404).json({ error: 'Referral relation not found for child address' });
        return;
      }
      res.status(200).json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

