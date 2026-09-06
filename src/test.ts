import assert from "assert";
import { z } from "zod";

const stellarWalletSchema = z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar wallet address");
const stellarAccountOrContractSchema = z.string().regex(/^[GC][A-Z2-7]{55}$/, "Invalid Stellar account or contract address");

console.log("Running StormSale backend validation tests...");

// Test 1: Valid Stellar G-address
const validG = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
assert.strictEqual(stellarWalletSchema.safeParse(validG).success, true, "Valid G-address should pass wallet validation");

// Test 2: Reject EVM 0x address
const invalidEVM = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
assert.strictEqual(stellarWalletSchema.safeParse(invalidEVM).success, false, "EVM 0x address should be rejected");

// Test 3: Reject malformed address
assert.strictEqual(stellarWalletSchema.safeParse("G123").success, false, "Short address should fail");
assert.strictEqual(stellarWalletSchema.safeParse("").success, false, "Empty address should fail");

// Test 4: Valid Soroban contract address C...
const validC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
assert.strictEqual(stellarAccountOrContractSchema.safeParse(validC).success, true, "Contract C-address should pass advertiser validation");
assert.strictEqual(stellarAccountOrContractSchema.safeParse(validG).success, true, "Wallet G-address should pass advertiser validation");

console.log("✔ All StormSale backend validation tests passed successfully!");

