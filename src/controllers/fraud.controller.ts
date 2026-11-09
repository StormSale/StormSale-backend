import { Request, Response } from 'express';
import { FraudService } from '../services/fraud.service';
import { z } from 'zod';

const fraudService = new FraudService();

const evalFraudSchema = z.object({
  campaignId: z.string().min(1),
  affiliateAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar affiliate address"),
  clickTimestamp: z.string().datetime(),
  conversionTimestamp: z.string().datetime(),
  ipHash: z.string().min(8),
  velocityPerMinute: z.number().nonnegative().optional(),
  campaignMeanVelocity: z.number().nonnegative().optional(),
  campaignStdDev: z.number().positive().optional()
});

const pauseAffiliateSchema = z.object({
  isPaused: z.boolean(),
  reason: z.string().optional()
});

export class FraudController {
  async evaluateRisk(req: Request, res: Response) {
    try {
      const parsed = evalFraudSchema.parse(req.body);
      const record = await fraudService.evaluateRisk(parsed);
      res.status(200).json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const { affiliateAddress } = req.params;
      const profile = await fraudService.getAffiliateRiskProfile(affiliateAddress as string);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async setPauseStatus(req: Request, res: Response) {
    try {
      const { affiliateAddress } = req.params;
      const parsed = pauseAffiliateSchema.parse(req.body);
      const result = await fraudService.setAffiliatePauseStatus(
        affiliateAddress as string,
        parsed.isPaused,
        parsed.reason
      );
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

