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
exports.UserService = void 0;
const prisma_1 = require("../config/prisma");
class UserService {
    findOrCreateUser(walletAddress, role) {
        return __awaiter(this, void 0, void 0, function* () {
            let user = yield prisma_1.prisma.user.findUnique({
                where: { walletAddress: walletAddress.toLowerCase() }
            });
            if (!user) {
                user = yield prisma_1.prisma.user.create({
                    data: {
                        walletAddress: walletAddress.toLowerCase(),
                        role: role || "AFFILIATE"
                    }
                });
            }
            else if (role && user.role !== role) {
                // Optional: Update role if passed and different
                user = yield prisma_1.prisma.user.update({
                    where: { id: user.id },
                    data: { role }
                });
            }
            return user;
        });
    }
    getUserProfile(walletAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.user.findUnique({
                where: { walletAddress: walletAddress.toLowerCase() },
                include: { campaigns: true } // If they are an advertiser
            });
        });
    }
}
exports.UserService = UserService;
