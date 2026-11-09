import { prisma } from '../config/prisma';

export interface CreateCampaignInput {
  title: string;
  description: string;
  tags: string;
  onChainId: string;
  advertiserWallet: string;
  audience?: 'B2B' | 'B2C';
  budget?: number;
  currency?: string;
  commissionRate?: number;
  clearingPeriod?: number;
  organizationId?: string;
}

export class CampaignService {
  async createCampaign(data: CreateCampaignInput) {
    // Ensure advertiser exists
    let user = await prisma.user.findUnique({
      where: { walletAddress: data.advertiserWallet.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: data.advertiserWallet.toLowerCase(),
          role: "ADVERTISER"
        }
      });
    }

    return prisma.campaign.create({
      data: {
        title: data.title,
        description: data.description,
        tags: data.tags,
        onChainId: data.onChainId,
        audience: data.audience || 'B2C',
        budget: data.budget ?? 0.0,
        currency: data.currency || 'XLM',
        commissionRate: data.commissionRate ?? 10.0,
        clearingPeriod: data.clearingPeriod ?? 86400,
        organizationId: data.organizationId,
        advertiserId: user.id
      }
    });
  }

  async getCampaign(id: string) {
    return prisma.campaign.findUnique({
      where: { id },
      include: { advertiser: true, organization: true }
    });
  }

  async listCampaigns(filters?: { audience?: 'B2B' | 'B2C'; organizationId?: string }) {
    const where: any = {};
    if (filters?.audience) where.audience = filters.audience;
    if (filters?.organizationId) where.organizationId = filters.organizationId;

    return prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { advertiser: true, organization: true }
    });
  }
}
