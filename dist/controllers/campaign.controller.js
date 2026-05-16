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
exports.CampaignController = void 0;
const campaign_service_1 = require("../services/campaign.service");
const zod_1 = require("zod");
const campaignService = new campaign_service_1.CampaignService();
const createCampaignSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().min(10),
    tags: zod_1.z.string(),
    onChainId: zod_1.z.string(),
    advertiserWallet: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address")
});
class CampaignController {
    createCampaign(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const parsed = createCampaignSchema.parse(req.body);
                const campaign = yield campaignService.createCampaign(parsed);
                res.status(201).json(campaign);
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    res.status(400).json({ error: error.errors });
                    return;
                }
                res.status(500).json({ error: error.message });
            }
        });
    }
    getCampaign(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const campaign = yield campaignService.getCampaign(id);
                if (!campaign) {
                    res.status(404).json({ error: 'Campaign not found' });
                    return;
                }
                res.status(200).json(campaign);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    listCampaigns(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaigns = yield campaignService.listCampaigns();
                res.status(200).json(campaigns);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.CampaignController = CampaignController;
