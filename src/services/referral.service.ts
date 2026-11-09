import { prisma } from '../config/prisma';

export interface RegisterReferralInput {
  recruiterAddress: string;
  childAddress: string;
  tier?: number;
  overrideRatePercent?: number;
  directCommissionRatePercent?: number;
}

export interface CalculateCommissionSplitInput {
  saleAmountXlm: number;
  totalCommissionRatePercent: number;
  sellingAffiliateAddress: string;
  recruiterAddress?: string;
  overrideRatePercent?: number;
}

export class ReferralService {
  async registerReferral(data: RegisterReferralInput) {
    const recruiter = data.recruiterAddress.toLowerCase();
    const child = data.childAddress.toLowerCase();

    if (recruiter === child) {
      throw new Error("Affiliate cannot recruit themselves");
    }

    const existing = await prisma.referralRelation.findUnique({
      where: { childAddress: child }
    });

    if (existing) {
      throw new Error("Sub-affiliate is already recruited by " + existing.recruiterAddress);
    }

    return prisma.referralRelation.create({
      data: {
        recruiterAddress: recruiter,
        childAddress: child,
        tier: data.tier ?? 1,
        overrideRatePercent: data.overrideRatePercent ?? 2.0,
        directCommissionRatePercent: data.directCommissionRatePercent ?? 8.0,
        status: "active",
      }
    });
  }

  async getRecruiterTree(recruiterAddress: string) {
    const recruiter = recruiterAddress.toLowerCase();

    // 1. Fetch Tier 1 referrals
    const tier1 = await prisma.referralRelation.findMany({
      where: { recruiterAddress: recruiter }
    });

    // 2. Fetch Tier 2 referrals
    const childrenTree: any[] = [];
    let secondTierCount = 0;
    let totalSalesVolumeXlm = 0;
    let totalOverrideEarnedXlm = 0;

    for (const t1 of tier1) {
      totalSalesVolumeXlm += t1.salesVolumeXlm;
      totalOverrideEarnedXlm += t1.overrideEarnedXlm;

      const subRecruits = await prisma.referralRelation.findMany({
        where: { recruiterAddress: t1.childAddress }
      });
      secondTierCount += subRecruits.length;

      childrenTree.push({
        ...t1,
        children: subRecruits
      });
    }

    return {
      masterAddress: recruiter,
      directRecruitsCount: tier1.length,
      secondTierRecruitsCount: secondTierCount,
      totalSalesVolumeXlm,
      totalOverrideEarnedXlm,
      tree: childrenTree
    };
  }

  calculateCommissionSplit(input: CalculateCommissionSplitInput) {
    const {
      saleAmountXlm,
      totalCommissionRatePercent,
      sellingAffiliateAddress,
      recruiterAddress,
      overrideRatePercent = 2.0
    } = input;

    const totalCommissionXlm = Number(((saleAmountXlm * totalCommissionRatePercent) / 100).toFixed(7));
    const hasRecruiter = Boolean(recruiterAddress && recruiterAddress.trim().length > 0);

    let recruiterOverrideCommissionXlm = 0;
    let sellingAffiliateCommissionXlm = totalCommissionXlm;
    let recruiterRate = 0;
    let sellingRate = totalCommissionRatePercent;

    if (hasRecruiter) {
      recruiterRate = overrideRatePercent;
      sellingRate = Math.max(0, totalCommissionRatePercent - recruiterRate);
      recruiterOverrideCommissionXlm = Number(((saleAmountXlm * recruiterRate) / 100).toFixed(7));
      sellingAffiliateCommissionXlm = Number(Math.max(0, totalCommissionXlm - recruiterOverrideCommissionXlm).toFixed(7));
    }

    const STROOPS_PER_XLM = 10000000;
    const sellingAffiliateStroops = BigInt(Math.round(sellingAffiliateCommissionXlm * STROOPS_PER_XLM));
    const recruiterOverrideStroops = BigInt(Math.round(recruiterOverrideCommissionXlm * STROOPS_PER_XLM));

    const splitRatioLabel = hasRecruiter
      ? `${Math.round((sellingRate / totalCommissionRatePercent) * 100)}% / ${Math.round((recruiterRate / totalCommissionRatePercent) * 100)}%`
      : '100% / 0%';

    return {
      saleAmountXlm,
      totalCommissionRatePercent,
      totalCommissionXlm,
      sellingAffiliateAddress: sellingAffiliateAddress.toLowerCase(),
      sellingAffiliateRatePercent: sellingRate,
      sellingAffiliateCommissionXlm,
      sellingAffiliateStroops: sellingAffiliateStroops.toString(),
      recruiterAddress: recruiterAddress ? recruiterAddress.toLowerCase() : null,
      recruiterOverrideRatePercent: recruiterRate,
      recruiterOverrideCommissionXlm,
      recruiterOverrideStroops: recruiterOverrideStroops.toString(),
      hasRecruiter,
      splitRatioLabel
    };
  }

  async recordSale(childAddress: string, saleAmountXlm: number, overrideEarnedXlm: number) {
    const child = childAddress.toLowerCase();
    const relation = await prisma.referralRelation.findUnique({
      where: { childAddress: child }
    });

    if (!relation) {
      return null;
    }

    return prisma.referralRelation.update({
      where: { id: relation.id },
      data: {
        salesVolumeXlm: relation.salesVolumeXlm + saleAmountXlm,
        overrideEarnedXlm: relation.overrideEarnedXlm + overrideEarnedXlm,
        salesCount: relation.salesCount + 1
      }
    });
  }
}

