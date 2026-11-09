import { Request, Response } from 'express';
import { ShortLinkService } from '../services/shortlink.service';
import { z } from 'zod';

const shortLinkService = new ShortLinkService();

const createShortLinkSchema = z.object({
  slug: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/, "Slug must be 3-32 alphanumeric characters, dashes, or underscores").optional(),
  targetUrl: z.string().url("Valid destination targetUrl is required"),
  campaignId: z.string().min(1),
  affiliateWallet: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar affiliate wallet address")
});

export class ShortLinkController {
  async createShortLink(req: Request, res: Response) {
    try {
      const parsed = createShortLinkSchema.parse(req.body);
      const link = await shortLinkService.createShortLink(parsed);
      res.status(201).json(link);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async resolveShortLink(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const ipHash = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const subId = req.query.subId as string | undefined;

      const link = await shortLinkService.resolveShortLink(slug as string, ipHash, subId);

      if (!link) {
        res.status(404).json({ error: 'Short link not found' });
        return;
      }

      res.status(200).json(link);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAffiliateLinks(req: Request, res: Response) {
    try {
      const { affiliateWallet } = req.params;
      const links = await shortLinkService.getAffiliateLinks(affiliateWallet as string);
      res.status(200).json(links);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

