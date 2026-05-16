import { prisma } from '../config/prisma';

export class UserService {
  async findOrCreateUser(walletAddress: string, role?: string) {
    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          role: role || "AFFILIATE"
        }
      });
    } else if (role && user.role !== role) {
      // Optional: Update role if passed and different
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role }
      });
    }

    return user;
  }

  async getUserProfile(walletAddress: string) {
    return prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: { campaigns: true } // If they are an advertiser
    });
  }
}
