import { EventEmitter } from 'events';
import { prisma } from '../config/prisma';

export type OrganizationRole = 'ADMIN' | 'MARKETING_MANAGER' | 'EDITOR' | 'FINANCE' | 'VIEWER';

export type OrgCapability =
  | 'org:manage'
  | 'campaign:create'
  | 'campaign:edit'
  | 'sale:log'
  | 'finance:approve'
  | 'analytics:read';

export const ROLE_CAPABILITIES: Record<OrganizationRole, readonly OrgCapability[]> = {
  ADMIN: ['org:manage', 'campaign:create', 'campaign:edit', 'sale:log', 'finance:approve', 'analytics:read'],
  MARKETING_MANAGER: ['campaign:create', 'campaign:edit', 'sale:log', 'analytics:read'],
  EDITOR: ['campaign:edit', 'sale:log', 'analytics:read'],
  FINANCE: ['finance:approve', 'analytics:read'],
  VIEWER: ['analytics:read'],
};

const REQUIRED_OPERATOR_CAPABILITIES: readonly OrgCapability[] = ['campaign:edit', 'sale:log'];

export interface CreateOrgInput {
  name: string;
  ownerAddress: string;
}

export interface AddTeamMemberInput {
  walletAddress: string;
  name: string;
  role: OrganizationRole;
  addedBy: string;
  status?: 'verified' | 'pending';
}

export interface NominateCampaignOperatorInput {
  organizationId: string;
  campaignId: string;
  operatorAddress: string;
  nominatedBy?: string;
  enabled?: boolean;
}

export interface SorobanOperatorInvocation {
  contractAddress: string;
  networkPassphrase: string;
  contractMethod: 'set_campaign_operator';
  args: Array<{
    name: 'campaign_id' | 'admin' | 'operator' | 'enabled';
    type: 'symbol' | 'address' | 'bool';
    value: string | boolean;
  }>;
}

export interface OperatorDelegationAuditLog {
  id: string;
  event: 'campaign.operator.nominated';
  organizationId: string;
  campaignId: string;
  onChainCampaignId: string;
  operatorAddress: string;
  memberId: string;
  memberRole: OrganizationRole;
  grantedCapabilities: OrgCapability[];
  nominatedBy: string;
  enabled: boolean;
  createdAt: Date;
}

export class OperatorDelegationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'OperatorDelegationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const operatorAuditEmitter = new EventEmitter();
const operatorAuditLogs: OperatorDelegationAuditLog[] = [];

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
        status: data.status || "verified"
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

  getCapabilitiesForRole(role: string): OrgCapability[] {
    const capabilities = ROLE_CAPABILITIES[role as OrganizationRole];
    return capabilities ? [...capabilities] : [];
  }

  async nominateCampaignOperator(input: NominateCampaignOperatorInput) {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId }
    });

    if (!org) {
      throw new OperatorDelegationError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      include: { advertiser: true }
    });

    if (!campaign) {
      throw new OperatorDelegationError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const belongsToOrg =
      campaign.organizationId === org.id ||
      (!campaign.organizationId &&
        campaign.advertiser?.walletAddress.toLowerCase() === org.ownerAddress.toLowerCase());

    if (!belongsToOrg) {
      throw new OperatorDelegationError(
        'Campaign does not belong to the specified organization',
        403,
        'CAMPAIGN_ORG_MISMATCH'
      );
    }

    const normalizedNominator = (input.nominatedBy || org.ownerAddress).toLowerCase();
    if (input.nominatedBy && normalizedNominator !== org.ownerAddress.toLowerCase()) {
      const nominatorMember = await prisma.teamMember.findFirst({
        where: {
          organizationId: org.id,
          walletAddress: normalizedNominator,
        }
      });

      if (
        !nominatorMember ||
        nominatorMember.status !== 'verified' ||
        (nominatorMember.role !== 'ADMIN' && nominatorMember.role !== 'MARKETING_MANAGER')
      ) {
        throw new OperatorDelegationError(
          'Nominator must be a verified ADMIN or MARKETING_MANAGER of the organization',
          403,
          'UNAUTHORIZED_NOMINATOR'
        );
      }
    }

    const candidateWallet = input.operatorAddress.toLowerCase();
    const candidateMember = await prisma.teamMember.findFirst({
      where: {
        organizationId: org.id,
        walletAddress: candidateWallet,
      }
    });

    if (!candidateMember) {
      throw new OperatorDelegationError(
        'Candidate operator wallet is not a member of this organization',
        403,
        'NOT_TEAM_MEMBER'
      );
    }

    if (candidateMember.status !== 'verified') {
      throw new OperatorDelegationError(
        'Candidate operator wallet is not verified as an active organization member',
        403,
        'UNVERIFIED_TEAM_MEMBER'
      );
    }

    const memberCapabilities = this.getCapabilitiesForRole(candidateMember.role);
    const matchingCapabilities = memberCapabilities.filter((cap) =>
      REQUIRED_OPERATOR_CAPABILITIES.includes(cap)
    );

    if (matchingCapabilities.length === 0) {
      throw new OperatorDelegationError(
        `Role '${candidateMember.role}' lacks required 'campaign:edit' or 'sale:log' capability for smart contract operator delegation`,
        403,
        'INSUFFICIENT_ROLE_CAPABILITY'
      );
    }

    const enabled = input.enabled ?? true;
    const sorobanInvocation: SorobanOperatorInvocation = {
      contractAddress:
        process.env.STORM_CONTRACT_ID ||
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      networkPassphrase:
        process.env.STELLAR_NETWORK_PASSPHRASE ||
        'Test SDF Network ; September 2015',
      contractMethod: 'set_campaign_operator',
      args: [
        { name: 'campaign_id', type: 'symbol', value: campaign.onChainId },
        { name: 'admin', type: 'address', value: normalizedNominator.toUpperCase() },
        { name: 'operator', type: 'address', value: candidateWallet.toUpperCase() },
        { name: 'enabled', type: 'bool', value: enabled },
      ],
    };

    const auditEntry: OperatorDelegationAuditLog = {
      id: 'aud-' + Math.random().toString(36).substring(2, 10),
      event: 'campaign.operator.nominated',
      organizationId: org.id,
      campaignId: campaign.id,
      onChainCampaignId: campaign.onChainId,
      operatorAddress: candidateWallet,
      memberId: candidateMember.id,
      memberRole: candidateMember.role as OrganizationRole,
      grantedCapabilities: matchingCapabilities,
      nominatedBy: normalizedNominator,
      enabled,
      createdAt: new Date(),
    };

    operatorAuditLogs.unshift(auditEntry);
    operatorAuditEmitter.emit('campaign.operator.nominated', auditEntry);

    return {
      organizationId: org.id,
      campaignId: campaign.id,
      onChainCampaignId: campaign.onChainId,
      operatorAddress: candidateWallet,
      role: candidateMember.role,
      grantedCapabilities: matchingCapabilities,
      enabled,
      sorobanInvocation,
      auditLog: auditEntry,
    };
  }

  getOperatorAuditLogs(organizationId: string): OperatorDelegationAuditLog[] {
    return operatorAuditLogs.filter((entry) => entry.organizationId === organizationId);
  }
}

