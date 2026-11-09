import { Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { z } from 'zod';

const webhookService = new WebhookService();

const registerWebhookSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2),
  url: z.string().url("Valid destination HTTPS endpoint URL is required"),
  events: z.array(z.string()).min(1, "At least one subscribed event is required")
});

export class WebhookController {
  async registerWebhook(req: Request, res: Response) {
    try {
      const parsed = registerWebhookSchema.parse(req.body);
      const webhook = await webhookService.registerWebhook(parsed);
      res.status(201).json(webhook);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getOrganizationWebhooks(req: Request, res: Response) {
    try {
      const { orgId } = req.params;
      const webhooks = await webhookService.getOrganizationWebhooks(orgId as string);
      res.status(200).json(webhooks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async sendTestPing(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await webhookService.sendTestPing(id as string);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Webhook endpoint not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

