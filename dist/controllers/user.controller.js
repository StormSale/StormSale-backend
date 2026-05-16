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
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
const zod_1 = require("zod");
const userService = new user_service_1.UserService();
const registerSchema = zod_1.z.object({
    walletAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address"),
    role: zod_1.z.enum(["ADVERTISER", "AFFILIATE", "AUDITOR"]).optional()
});
class UserController {
    registerOrLogin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const parsed = registerSchema.parse(req.body);
                const user = yield userService.findOrCreateUser(parsed.walletAddress, parsed.role);
                res.status(200).json(user);
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
    getProfile(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { walletAddress } = req.params;
                const user = yield userService.getUserProfile(walletAddress);
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                res.status(200).json(user);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.UserController = UserController;
