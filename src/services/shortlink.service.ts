import crypto from 'crypto';
import { prisma } from '../config/prisma';

export interface CreateShortLinkInput {
  slug?: string;
  targetUrl: string;
  campaignId: string;
  affiliateWallet: string;
}

export class ShortLinkService {
  async createShortLink(data: CreateShortLinkInput) {
    const slug = (data.slug && data.slug.trim().length > 0)
      ? data.slug.trim().toLowerCase()
      : crypto.randomBytes(4).toString('hex');

    const existing = await prisma.shortLink.findUnique({
      where: { slug }
    });

    if (existing) {
      throw new Error(`Custom slug '${slug}' is already in use`);
    }

    return prisma.shortLink.create({
      data: {
        slug,
        targetUrl: data.targetUrl,
        campaignId: data.campaignId,
        affiliateWallet: data.affiliateWallet.toLowerCase(),
        clicksCount: 0
      }
    });
  }

  async resolveShortLink(slug: string, ipHash?: string, subId?: string) {
    const link = await prisma.shortLink.findUnique({
      where: { slug: slug.toLowerCase() },
      include: { campaign: true }
    });

    if (!link) {
      return null;
    }

    // Increment clicks count
    const updated = await prisma.shortLink.update({
      where: { slug: link.slug },
      data: { clicksCount: { increment: 1 } }
    });

    // Record click event
    if (ipHash) {
      await prisma.click.create({
        data: {
          campaignId: link.campaignId,
          affiliateWallet: link.affiliateWallet,
          ipHash,
          subId: subId || null,
        }
      });
    }

    return updated;
  }

  async getAffiliateLinks(affiliateWallet: string) {
    return prisma.shortLink.findMany({
      where: { affiliateWallet: affiliateWallet.toLowerCase() }
    });
  }
}

