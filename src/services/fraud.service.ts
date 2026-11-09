import { prisma } from '../config/prisma';

export interface EvaluateFraudInput {
  campaignId: string;
  affiliateAddress: string;
  clickTimestamp: string;
  conversionTimestamp: string;
  ipHash: string;
  velocityPerMinute?: number;
  campaignMeanVelocity?: number;
  campaignStdDev?: number;
}

export type RiskScoreLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class FraudService {
  async evaluateRisk(input: EvaluateFraudInput) {
    const affiliate = input.affiliateAddress.toLowerCase();
    const clickTime = new Date(input.clickTimestamp).getTime();
    const convTime = new Date(input.conversionTimestamp).getTime();
    const timeDeltaSeconds = Math.max(0, (convTime - clickTime) / 1000);

    const isInstantAnomaly = timeDeltaSeconds < 2.0;

    const velocity = input.velocityPerMinute ?? 1.0;
    const mean = input.campaignMeanVelocity ?? 2.0;
    const stdDev = input.campaignStdDev && input.campaignStdDev > 0 ? input.campaignStdDev : 1.0;

    const zScore = Number(((velocity - mean) / stdDev).toFixed(2));
    const isVelocityAnomaly = zScore >= 3.0;

    let riskLevel: RiskScoreLevel = 'LOW';
    const reasons: string[] = [];

    if (isVelocityAnomaly && isInstantAnomaly) {
      riskLevel = 'CRITICAL';
      reasons.push('High burst velocity (Z >= 3.0) combined with sub-2s click-to-conversion delta');
    } else if (isVelocityAnomaly) {
      riskLevel = 'HIGH';
      reasons.push(`Velocity burst anomaly: Z-score is ${zScore} (> 3.0 standard deviations)`);
    } else if (isInstantAnomaly) {
      riskLevel = 'HIGH';
      reasons.push(`Instant click-to-conversion anomaly: ${timeDeltaSeconds}s elapsed (< 2.0s threshold)`);
    } else if (zScore >= 2.0) {
      riskLevel = 'MEDIUM';
      reasons.push(`Elevated velocity: Z-score is ${zScore} (> 2.0 standard deviations)`);
    }

    const isAnomaly = isVelocityAnomaly || isInstantAnomaly;

    // Check if affiliate was previously paused
    const existing = await prisma.fraudRecord.findFirst({
      where: { affiliateAddress: affiliate },
      orderBy: { createdAt: 'desc' }
    });

    const isPaused = existing?.isPaused || riskLevel === 'CRITICAL';

    return prisma.fraudRecord.create({
      data: {
        campaignId: input.campaignId,
        affiliateAddress: affiliate,
        riskLevel,
        velocityZScore: zScore,
        isAnomaly,
        isPaused,
        reason: reasons.length > 0 ? reasons.join('; ') : 'Normal telemetry bounds',
      }
    });
  }

  async getAffiliateRiskProfile(affiliateAddress: string) {
    const affiliate = affiliateAddress.toLowerCase();
    const records = await prisma.fraudRecord.findMany({
      where: { affiliateAddress: affiliate },
      orderBy: { createdAt: 'desc' }
    });

    const latest = records[0] || null;

    return {
      affiliateAddress: affiliate,
      isPaused: latest?.isPaused || false,
      currentRiskLevel: latest?.riskLevel || 'LOW',
      totalEvaluations: records.length,
      anomaliesDetected: records.filter((r) => r.isAnomaly).length,
      latestRecord: latest,
      history: records.slice(0, 10)
    };
  }

  async setAffiliatePauseStatus(affiliateAddress: string, isPaused: boolean, reason?: string) {
    const affiliate = affiliateAddress.toLowerCase();
    await prisma.fraudRecord.updateMany({
      where: { affiliateAddress: affiliate },
      data: { isPaused, reason: reason || (isPaused ? 'Manually paused by operator' : 'Manually unpaused') }
    });

    return {
      affiliateAddress: affiliate,
      isPaused,
      updatedAt: new Date()
    };
  }
}

