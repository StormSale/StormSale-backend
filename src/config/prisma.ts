import { PrismaClient } from "@prisma/client";

/**
 * In-Memory Mock Prisma Implementation for deterministic test suites and CI environments
 * where a live external PostgreSQL database is not available.
 */
function createInMemoryPrisma() {
  const users: any[] = [];
  const campaigns: any[] = [];
  const clicks: any[] = [];
  const organizations: any[] = [];
  const teamMembers: any[] = [];
  const referralRelations: any[] = [];
  const fraudRecords: any[] = [];
  const shortLinks: any[] = [];
  const webhookEndpoints: any[] = [];

  return {
    user: {
      async findUnique({ where }: any) {
        if (where.walletAddress) {
          const u = users.find(
            (x) => x.walletAddress.toLowerCase() === where.walletAddress.toLowerCase()
          );
          if (!u) return null;
          return {
            ...u,
            campaigns: campaigns.filter((c) => c.advertiserId === u.id),
          };
        }
        if (where.id) {
          return users.find((x) => x.id === where.id) || null;
        }
        return null;
      },
      async create({ data }: any) {
        const user = {
          id: "usr-" + Math.random().toString(36).substring(2, 9),
          walletAddress: data.walletAddress.toLowerCase(),
          role: data.role || "AFFILIATE",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(user);
        return user;
      },
      async update({ where, data }: any) {
        const user = users.find((x) => x.id === where.id);
        if (!user) throw new Error("User not found");
        Object.assign(user, data, { updatedAt: new Date() });
        return user;
      },
      async findMany() {
        return [...users];
      },
    },
    campaign: {
      async create({ data }: any) {
        const campaign = {
          id: "cmp-" + Math.random().toString(36).substring(2, 9),
          title: data.title,
          description: data.description,
          tags: data.tags,
          onChainId: data.onChainId,
          audience: data.audience || "B2C",
          budget: Number(data.budget ?? 0),
          currency: data.currency || "XLM",
          commissionRate: Number(data.commissionRate ?? 10.0),
          clearingPeriod: Number(data.clearingPeriod ?? 86400),
          advertiserId: data.advertiserId,
          organizationId: data.organizationId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        campaigns.push(campaign);
        return campaign;
      },
      async findUnique({ where, include }: any) {
        const campaign = campaigns.find((x) => x.id === where.id);
        if (!campaign) return null;
        const res = { ...campaign };
        if (include?.advertiser) {
          res.advertiser = users.find((u) => u.id === campaign.advertiserId) || null;
        }
        if (include?.organization) {
          res.organization = organizations.find((o) => o.id === campaign.organizationId) || null;
        }
        return res;
      },
      async findMany({ where, include, orderBy }: any = {}) {
        let res = [...campaigns];
        if (where?.audience) {
          res = res.filter((c) => c.audience === where.audience);
        }
        if (where?.organizationId) {
          res = res.filter((c) => c.organizationId === where.organizationId);
        }
        res = res.map((c) => {
          const item = { ...c };
          if (include?.advertiser) {
            item.advertiser = users.find((u) => u.id === c.advertiserId) || null;
          }
          if (include?.organization) {
            item.organization = organizations.find((o) => o.id === c.organizationId) || null;
          }
          return item;
        });
        if (orderBy?.createdAt === "desc") {
          res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return res;
      },
    },
    click: {
      async create({ data }: any) {
        const click = {
          id: "clk-" + Math.random().toString(36).substring(2, 9),
          ...data,
          createdAt: new Date(),
        };
        clicks.push(click);
        return click;
      },
      async findMany({ where }: any = {}) {
        let res = [...clicks];
        if (where?.campaignId) {
          res = res.filter((c) => c.campaignId === where.campaignId);
        }
        if (where?.affiliateWallet) {
          res = res.filter((c) => c.affiliateWallet.toLowerCase() === where.affiliateWallet.toLowerCase());
        }
        return res;
      },
    },
    organization: {
      async create({ data }: any) {
        const org = {
          id: "org-" + Math.random().toString(36).substring(2, 9),
          name: data.name,
          ownerAddress: data.ownerAddress.toLowerCase(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        organizations.push(org);

        // Auto-add owner as ADMIN team member
        const ownerMember = {
          id: "mem-" + Math.random().toString(36).substring(2, 9),
          organizationId: org.id,
          walletAddress: data.ownerAddress.toLowerCase(),
          name: "Owner (" + data.ownerAddress.substring(0, 6) + "...",
          role: "ADMIN",
          addedBy: data.ownerAddress.toLowerCase(),
          status: "verified",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        teamMembers.push(ownerMember);

        return org;
      },
      async findUnique({ where, include }: any) {
        const org = organizations.find((o) => o.id === where.id);
        if (!org) return null;
        const res = { ...org };
        if (include?.members) {
          res.members = teamMembers.filter((m) => m.organizationId === org.id);
        }
        if (include?.campaigns) {
          res.campaigns = campaigns.filter((c) => c.organizationId === org.id);
        }
        if (include?.webhooks) {
          res.webhooks = webhookEndpoints.filter((w) => w.organizationId === org.id);
        }
        return res;
      },
      async findMany({ where, include }: any = {}) {
        let res = [...organizations];
        if (where?.ownerAddress) {
          res = res.filter((o) => o.ownerAddress.toLowerCase() === where.ownerAddress.toLowerCase());
        }
        return res.map((org) => {
          const item = { ...org };
          if (include?.members) {
            item.members = teamMembers.filter((m) => m.organizationId === org.id);
          }
          return item;
        });
      },
    },
    teamMember: {
      async create({ data }: any) {
        const member = {
          id: "mem-" + Math.random().toString(36).substring(2, 9),
          organizationId: data.organizationId,
          walletAddress: data.walletAddress.toLowerCase(),
          name: data.name || "Member",
          role: data.role || "VIEWER",
          addedBy: data.addedBy.toLowerCase(),
          status: data.status || "verified",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        teamMembers.push(member);
        return member;
      },
      async findMany({ where }: any = {}) {
        let res = [...teamMembers];
        if (where?.organizationId) {
          res = res.filter((m) => m.organizationId === where.organizationId);
        }
        if (where?.walletAddress) {
          res = res.filter((m) => m.walletAddress.toLowerCase() === where.walletAddress.toLowerCase());
        }
        return res;
      },
      async findFirst({ where }: any) {
        return (
          teamMembers.find(
            (m) =>
              (!where.organizationId || m.organizationId === where.organizationId) &&
              (!where.walletAddress || m.walletAddress.toLowerCase() === where.walletAddress.toLowerCase())
          ) || null
        );
      },
      async delete({ where }: any) {
        const idx = teamMembers.findIndex((m) => m.id === where.id);
        if (idx === -1) throw new Error("Team member not found");
        const [deleted] = teamMembers.splice(idx, 1);
        return deleted;
      },
    },
    referralRelation: {
      async create({ data }: any) {
        const relation = {
          id: "ref-" + Math.random().toString(36).substring(2, 9),
          recruiterAddress: data.recruiterAddress.toLowerCase(),
          childAddress: data.childAddress.toLowerCase(),
          tier: Number(data.tier ?? 1),
          overrideRatePercent: Number(data.overrideRatePercent ?? 2.0),
          directCommissionRatePercent: Number(data.directCommissionRatePercent ?? 8.0),
          status: data.status || "active",
          salesVolumeXlm: Number(data.salesVolumeXlm ?? 0.0),
          overrideEarnedXlm: Number(data.overrideEarnedXlm ?? 0.0),
          salesCount: Number(data.salesCount ?? 0),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        referralRelations.push(relation);
        return relation;
      },
      async findUnique({ where }: any) {
        if (where.childAddress) {
          return referralRelations.find((r) => r.childAddress.toLowerCase() === where.childAddress.toLowerCase()) || null;
        }
        if (where.id) {
          return referralRelations.find((r) => r.id === where.id) || null;
        }
        return null;
      },
      async findMany({ where }: any = {}) {
        let res = [...referralRelations];
        if (where?.recruiterAddress) {
          res = res.filter((r) => r.recruiterAddress.toLowerCase() === where.recruiterAddress.toLowerCase());
        }
        return res;
      },
      async update({ where, data }: any) {
        const rel = referralRelations.find((r) => r.id === where.id || (where.childAddress && r.childAddress.toLowerCase() === where.childAddress.toLowerCase()));
        if (!rel) throw new Error("Referral relation not found");
        Object.assign(rel, data, { updatedAt: new Date() });
        return rel;
      },
    },
    fraudRecord: {
      async create({ data }: any) {
        const record = {
          id: "frd-" + Math.random().toString(36).substring(2, 9),
          campaignId: data.campaignId,
          affiliateAddress: data.affiliateAddress.toLowerCase(),
          riskLevel: data.riskLevel || "LOW",
          velocityZScore: Number(data.velocityZScore ?? 0.0),
          isAnomaly: Boolean(data.isAnomaly ?? false),
          isPaused: Boolean(data.isPaused ?? false),
          reason: data.reason || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        fraudRecords.push(record);
        return record;
      },
      async findMany({ where, orderBy }: any = {}) {
        let res = [...fraudRecords];
        if (where?.affiliateAddress) {
          res = res.filter((f) => f.affiliateAddress.toLowerCase() === where.affiliateAddress.toLowerCase());
        }
        if (where?.campaignId) {
          res = res.filter((f) => f.campaignId === where.campaignId);
        }
        if (orderBy?.createdAt === "desc") {
          res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return res;
      },
      async findFirst({ where, orderBy }: any = {}) {
        let res = [...fraudRecords];
        if (where?.affiliateAddress) {
          res = res.filter((f) => f.affiliateAddress.toLowerCase() === where.affiliateAddress.toLowerCase());
        }
        if (orderBy?.createdAt === "desc") {
          res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return res[0] || null;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const item of fraudRecords) {
          if (!where.affiliateAddress || item.affiliateAddress.toLowerCase() === where.affiliateAddress.toLowerCase()) {
            Object.assign(item, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
    },
    shortLink: {
      async create({ data }: any) {
        const link = {
          id: "lnk-" + Math.random().toString(36).substring(2, 9),
          slug: data.slug,
          targetUrl: data.targetUrl,
          campaignId: data.campaignId,
          affiliateWallet: data.affiliateWallet.toLowerCase(),
          clicksCount: Number(data.clicksCount ?? 0),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        shortLinks.push(link);
        return link;
      },
      async findUnique({ where, include }: any) {
        const link = shortLinks.find((l) => l.slug === where.slug || (where.id && l.id === where.id));
        if (!link) return null;
        const res = { ...link };
        if (include?.campaign) {
          res.campaign = campaigns.find((c) => c.id === link.campaignId) || null;
        }
        return res;
      },
      async findMany({ where }: any = {}) {
        let res = [...shortLinks];
        if (where?.affiliateWallet) {
          res = res.filter((l) => l.affiliateWallet.toLowerCase() === where.affiliateWallet.toLowerCase());
        }
        if (where?.campaignId) {
          res = res.filter((l) => l.campaignId === where.campaignId);
        }
        return res;
      },
      async update({ where, data }: any) {
        const link = shortLinks.find((l) => l.slug === where.slug || l.id === where.id);
        if (!link) throw new Error("ShortLink not found");
        if (data.clicksCount && typeof data.clicksCount === "object" && data.clicksCount.increment) {
          link.clicksCount += data.clicksCount.increment;
        } else if (data.clicksCount !== undefined) {
          link.clicksCount = data.clicksCount;
        }
        Object.assign(link, { updatedAt: new Date() });
        return link;
      },
    },
    webhookEndpoint: {
      async create({ data }: any) {
        const webhook = {
          id: "wh-" + Math.random().toString(36).substring(2, 9),
          organizationId: data.organizationId,
          name: data.name,
          url: data.url,
          secret: data.secret,
          events: data.events,
          isActive: data.isActive ?? true,
          failureCount: 0,
          totalDeliveries: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        webhookEndpoints.push(webhook);
        return webhook;
      },
      async findUnique({ where }: any) {
        return webhookEndpoints.find((w) => w.id === where.id) || null;
      },
      async findMany({ where }: any = {}) {
        let res = [...webhookEndpoints];
        if (where?.organizationId) {
          res = res.filter((w) => w.organizationId === where.organizationId);
        }
        return res;
      },
      async update({ where, data }: any) {
        const wh = webhookEndpoints.find((w) => w.id === where.id);
        if (!wh) throw new Error("Webhook endpoint not found");
        if (data.totalDeliveries && typeof data.totalDeliveries === "object" && data.totalDeliveries.increment) {
          wh.totalDeliveries += data.totalDeliveries.increment;
        } else if (data.totalDeliveries !== undefined) {
          wh.totalDeliveries = data.totalDeliveries;
        }
        Object.assign(wh, data, { updatedAt: new Date() });
        return wh;
      },
    },
    $disconnect: async () => {},
  } as unknown as PrismaClient;
}

const isTestOrMissingDb =
  process.env.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test" ||
  !process.env.DATABASE_URL ||
  process.argv.some((arg) => arg.includes("test"));

const prismaClientSingleton = () => {
  if (isTestOrMissingDb) {
    return createInMemoryPrisma();
  }
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
