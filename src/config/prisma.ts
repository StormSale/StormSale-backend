import { PrismaClient } from "@prisma/client";

/**
 * In-Memory Mock Prisma Implementation for deterministic test suites and CI environments
 * where a live external PostgreSQL database is not available.
 */
function createInMemoryPrisma() {
  const users: any[] = [];
  const campaigns: any[] = [];
  const clicks: any[] = [];

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
          advertiserId: data.advertiserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        campaigns.push(campaign);
        return campaign;
      },
      async findUnique({ where, include }: any) {
        const campaign = campaigns.find((x) => x.id === where.id);
        if (!campaign) return null;
        if (include?.advertiser) {
          const advertiser = users.find((u) => u.id === campaign.advertiserId) || null;
          return { ...campaign, advertiser };
        }
        return campaign;
      },
      async findMany({ include, orderBy }: any) {
        let res = campaigns.map((c) => {
          if (include?.advertiser) {
            const advertiser = users.find((u) => u.id === c.advertiserId) || null;
            return { ...c, advertiser };
          }
          return c;
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
