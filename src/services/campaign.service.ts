import { prisma } from '../config/prisma';

export class CampaignService {
  async createCampaign(data: { title: string, description: string, tags: string, onChainId: string, advertiserWallet: string }) {
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
        advertiserId: user.id
      }
    });
  }

  async getCampaign(id: string) {
    return prisma.campaign.findUnique({
      where: { id },
      include: { advertiser: true }
    });
  }

  async listCampaigns() {
    return prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { advertiser: true }
    });
  }
}
