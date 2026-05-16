"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const prisma_1 = require("../config/prisma");
class CampaignService {
    createCampaign(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure advertiser exists
            let user = yield prisma_1.prisma.user.findUnique({
                where: { walletAddress: data.advertiserWallet.toLowerCase() }
            });
            if (!user) {
                user = yield prisma_1.prisma.user.create({
                    data: {
                        walletAddress: data.advertiserWallet.toLowerCase(),
                        role: "ADVERTISER"
                    }
                });
            }
            return prisma_1.prisma.campaign.create({
                data: {
                    title: data.title,
                    description: data.description,
                    tags: data.tags,
                    onChainId: data.onChainId,
                    advertiserId: user.id
                }
            });
        });
    }
    getCampaign(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.campaign.findUnique({
                where: { id },
                include: { advertiser: true }
            });
        });
    }
    listCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.campaign.findMany({
                orderBy: { createdAt: 'desc' },
                include: { advertiser: true }
            });
        });
    }
}
exports.CampaignService = CampaignService;
