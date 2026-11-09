import { prisma } from '../config/prisma';

export interface CreateOrgInput {
  name: string;
  ownerAddress: string;
}

export interface AddTeamMemberInput {
  walletAddress: string;
  name: string;
  role: 'ADMIN' | 'MARKETING_MANAGER' | 'EDITOR' | 'FINANCE' | 'VIEWER';
  addedBy: string;
}

export class OrganizationService {
  async createOrganization(data: CreateOrgInput) {
    return prisma.organization.create({
      data: {
        name: data.name,
        ownerAddress: data.ownerAddress.toLowerCase(),
      }
    });
  }

  async getOrganization(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: { members: true, campaigns: true, webhooks: true }
    });
  }

  async listOrganizationsByOwner(ownerAddress: string) {
    return prisma.organization.findMany({
      where: { ownerAddress: ownerAddress.toLowerCase() },
      include: { members: true }
    });
  }

  async addTeamMember(orgId: string, data: AddTeamMemberInput) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    return prisma.teamMember.create({
      data: {
        organizationId: orgId,
        walletAddress: data.walletAddress.toLowerCase(),
        name: data.name,
        role: data.role,
        addedBy: data.addedBy.toLowerCase(),
        status: "verified"
      }
    });
  }

  async getTeamMembers(orgId: string) {
    return prisma.teamMember.findMany({
      where: { organizationId: orgId }
    });
  }

  async removeTeamMember(orgId: string, memberId: string) {
    return prisma.teamMember.delete({
      where: { id: memberId }
    });
  }
}

