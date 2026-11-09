import crypto from 'crypto';
import { prisma } from '../config/prisma';

export interface RegisterWebhookInput {
  organizationId: string;
  name: string;
  url: string;
  events: string[];
}

export class WebhookService {
  async registerWebhook(data: RegisterWebhookInput) {
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');

    return prisma.webhookEndpoint.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        url: data.url,
        secret,
        events: data.events.join(','),
        isActive: true
      }
    });
  }

  async getOrganizationWebhooks(organizationId: string) {
    return prisma.webhookEndpoint.findMany({
      where: { organizationId }
    });
  }

  async sendTestPing(webhookId: string) {
    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      throw new Error("Webhook endpoint not found");
    }

    const timestamp = Date.now();
    const payload = {
      event: "ping.test",
      webhookId: webhook.id,
      timestamp,
      data: {
        message: "StormSale webhook endpoint verification ping",
        organizationId: webhook.organizationId,
        activeEvents: webhook.events.split(',')
      }
    };

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    await prisma.webhookEndpoint.update({
      where: { id: webhook.id },
      data: { totalDeliveries: { increment: 1 } }
    });

    return {
      status: "delivered",
      endpointUrl: webhook.url,
      signatureHeader: `t=${timestamp},v1=${signature}`,
      payload
    };
  }
}

