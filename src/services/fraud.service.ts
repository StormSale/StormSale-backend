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

export interface IpConcentrationMetrics {
  totalConversions: number;
  uniqueIps: number;
  topIpHash: string | null;
  topIpConversions: number;
  topIpConcentration: number;
  giniCoefficient: number;
  shannonEntropy: number;
  isLowSampleSize: boolean;
  isConcentrationAnomaly: boolean;
}

const RISK_SEVERITY: Record<RiskScoreLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function elevateRiskLevel(current: RiskScoreLevel, candidate: RiskScoreLevel): RiskScoreLevel {
  return RISK_SEVERITY[candidate] > RISK_SEVERITY[current] ? candidate : current;
}

export class FraudService {
  calculateIpConcentration(ipHashes: string[]): IpConcentrationMetrics {
    const normalized = ipHashes
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);
    const totalConversions = normalized.length;

    if (totalConversions === 0) {
      return {
        totalConversions: 0,
        uniqueIps: 0,
        topIpHash: null,
        topIpConversions: 0,
        topIpConcentration: 0,
        giniCoefficient: 0,
        shannonEntropy: 1,
        isLowSampleSize: true,
        isConcentrationAnomaly: false,
      };
    }

    const frequencyMap = new Map<string, number>();
    let topIpHash: string | null = null;
    let topIpConversions = 0;

    for (const ip of normalized) {
      const nextCount = (frequencyMap.get(ip) ?? 0) + 1;
      frequencyMap.set(ip, nextCount);
      if (nextCount > topIpConversions) {
        topIpConversions = nextCount;
        topIpHash = ip;
      }
    }

    const uniqueIps = frequencyMap.size;
    const topIpConcentration = Number(((topIpConversions / totalConversions) * 100).toFixed(2));
    const isLowSampleSize = totalConversions <= 3;

    let giniCoefficient = 0;
    let shannonEntropy = 1;

    if (totalConversions > 1) {
      // Pad observed IP conversion buckets across N conversion slots so single-IP
      // monopoly yields Gini = 1.0 and N distinct IPs yields Gini = 0.0.
      const counts = Array.from(frequencyMap.values());
      const slots: number[] = new Array(totalConversions - counts.length).fill(0).concat(counts);
      slots.sort((a, b) => a - b);

      let weightedDiffSum = 0;
      for (let i = 0; i < totalConversions; i++) {
        weightedDiffSum += (2 * (i + 1) - totalConversions - 1) * slots[i];
      }
      const rawGini = weightedDiffSum / (totalConversions * totalConversions);
      const normalizedGini = rawGini * (totalConversions / (totalConversions - 1));
      giniCoefficient = Number(Math.min(1, Math.max(0, normalizedGini)).toFixed(4));

      let rawEntropy = 0;
      for (const count of counts) {
        const p = count / totalConversions;
        if (p > 0) {
          rawEntropy -= p * Math.log2(p);
        }
      }
      const maxEntropy = Math.log2(totalConversions);
      shannonEntropy = maxEntropy > 0
        ? Number(Math.min(1, Math.max(0, rawEntropy / maxEntropy)).toFixed(4))
        : 0;
    }

    const isProxyCyclingAnomaly =
      !isLowSampleSize &&
      totalConversions >= 8 &&
      giniCoefficient >= 0.85 &&
      shannonEntropy <= 0.35;

    const isConcentrationAnomaly =
      !isLowSampleSize &&
      totalConversions > 5 &&
      (topIpConcentration > 50 || isProxyCyclingAnomaly);

    return {
      totalConversions,
      uniqueIps,
      topIpHash,
      topIpConversions,
      topIpConcentration,
      giniCoefficient,
      shannonEntropy,
      isLowSampleSize,
      isConcentrationAnomaly,
    };
  }

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

    // Fetch historical conversion records for affiliate IP concentration analysis
    const priorRecords = await prisma.fraudRecord.findMany({
      where: { affiliateAddress: affiliate },
      orderBy: { createdAt: 'desc' }
    });

    const historicalIps: string[] = [];
    for (const record of priorRecords) {
      if (record.ipHash) {
        historicalIps.push(record.ipHash);
      }
    }
    historicalIps.push(input.ipHash);

    const ipMetrics = this.calculateIpConcentration(historicalIps);

    if (ipMetrics.isConcentrationAnomaly) {
      if (ipMetrics.topIpConcentration >= 80 || (ipMetrics.topIpConcentration > 50 && (isVelocityAnomaly || isInstantAnomaly))) {
        riskLevel = elevateRiskLevel(riskLevel, 'CRITICAL');
        reasons.push(
          `Severe IP concentration anomaly: ${ipMetrics.topIpConcentration}% from top IP across ${ipMetrics.totalConversions} conversions (Gini=${ipMetrics.giniCoefficient}, Entropy=${ipMetrics.shannonEntropy})`
        );
      } else {
        riskLevel = elevateRiskLevel(riskLevel, 'HIGH');
        reasons.push(
          `IP concentration anomaly: ${ipMetrics.topIpConcentration}% from top IP across ${ipMetrics.totalConversions} conversions (Gini=${ipMetrics.giniCoefficient}, Entropy=${ipMetrics.shannonEntropy})`
        );
      }
    }

    const isAnomaly = isVelocityAnomaly || isInstantAnomaly || ipMetrics.isConcentrationAnomaly;

    const existing = priorRecords[0] || null;
    const isPaused = existing?.isPaused || riskLevel === 'CRITICAL';

    return prisma.fraudRecord.create({
      data: {
        campaignId: input.campaignId,
        affiliateAddress: affiliate,
        ipHash: input.ipHash,
        riskLevel,
        velocityZScore: zScore,
        topIpConcentration: ipMetrics.topIpConcentration,
        ipGiniCoefficient: ipMetrics.giniCoefficient,
        ipEntropy: ipMetrics.shannonEntropy,
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
    const ipHashes = records
      .map((r) => r.ipHash)
      .filter((ip): ip is string => typeof ip === 'string' && ip.length > 0);
    const ipMetrics = this.calculateIpConcentration(ipHashes);

    return {
      affiliateAddress: affiliate,
      isPaused: latest?.isPaused || false,
      currentRiskLevel: latest?.riskLevel || 'LOW',
      totalEvaluations: records.length,
      anomaliesDetected: records.filter((r) => r.isAnomaly).length,
      topIpConcentration: latest ? latest.topIpConcentration : ipMetrics.topIpConcentration,
      ipGiniCoefficient: latest ? latest.ipGiniCoefficient : ipMetrics.giniCoefficient,
      ipEntropy: latest ? latest.ipEntropy : ipMetrics.shannonEntropy,
      uniqueIpCount: ipMetrics.uniqueIps,
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

