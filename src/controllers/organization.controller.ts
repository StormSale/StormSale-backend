import { Request, Response } from 'express';
import { OrganizationService } from '../services/organization.service';
import { z } from 'zod';

const organizationService = new OrganizationService();

const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  ownerAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar owner address")
});

const addMemberSchema = z.object({
  walletAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar member address"),
  name: z.string().min(1, "Member name is required"),
  role: z.enum(["ADMIN", "MARKETING_MANAGER", "EDITOR", "FINANCE", "VIEWER"]),
  addedBy: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar inviter address")
});

export class OrganizationController {
  async createOrganization(req: Request, res: Response) {
    try {
      const parsed = createOrgSchema.parse(req.body);
      const org = await organizationService.createOrganization(parsed);
      res.status(201).json(org);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getOrganization(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const org = await organizationService.getOrganization(id as string);
      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.status(200).json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async listByOwner(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;
      const orgs = await organizationService.listOrganizationsByOwner(walletAddress as string);
      res.status(200).json(orgs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async addTeamMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parsed = addMemberSchema.parse(req.body);
      const member = await organizationService.addTeamMember(id as string, parsed);
      res.status(201).json(member);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: (error as z.ZodError).issues });
        return;
      }
      if (error.message === 'Organization not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getTeamMembers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const members = await organizationService.getTeamMembers(id as string);
      res.status(200).json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async removeTeamMember(req: Request, res: Response) {
    try {
      const { id, memberId } = req.params;
      await organizationService.removeTeamMember(id as string, memberId as string);
      res.status(200).json({ success: true, removedMemberId: memberId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

