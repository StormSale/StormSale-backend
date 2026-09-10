process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import { app } from '../app';

async function runApiIntegrationTests() {
  console.log('\n======================================================');
  console.log('🚀 StormSale Backend API Endpoints Integration Test Suite');
  console.log('======================================================\n');

  // Start in-process server on ephemeral port (0 = OS assigns free port)
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log(`[Test Server] Ephemeral HTTP listener active on ${baseUrl}\n`);

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message || err}`);
      throw err;
    }
  }

  try {
    // ----------------------------------------------------
    // 1. Health Endpoint
    // ----------------------------------------------------
    await test('GET /health returns 200 and operational status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'OK');
      assert.ok(data.timestamp, 'Timestamp must be present');
    });

    // ----------------------------------------------------
    // 2. User Registration & Validation
    // ----------------------------------------------------
    const testAdvertiserWallet = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const testAffiliateWallet = 'GDZ3A7OQG6FHKH6R3O2XZS5G442XMQ34F35Z4U5Q73A4H6Z3J2B5TEST';

    await test('POST /api/users registers valid Stellar advertiser wallet', async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: testAdvertiserWallet,
          role: 'ADVERTISER',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.walletAddress, testAdvertiserWallet.toLowerCase());
      assert.strictEqual(data.role, 'ADVERTISER');
      assert.ok(data.id, 'User ID must be assigned');
    });

    await test('POST /api/users updates role idempotently on subsequent login', async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: testAdvertiserWallet,
          role: 'ADVERTISER',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.walletAddress, testAdvertiserWallet.toLowerCase());
    });

    await test('POST /api/users rejects EVM 0x address with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          role: 'ADVERTISER',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error, 'Should return validation error');
    });

    await test('POST /api/users rejects malformed address and invalid role with 400', async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: 'G_INVALID',
          role: 'SUPERADMIN',
        }),
      });

      assert.strictEqual(res.status, 400);
    });

    // ----------------------------------------------------
    // 3. User Profile Retrieval
    // ----------------------------------------------------
    await test('GET /api/users/:walletAddress returns existing user profile', async () => {
      const res = await fetch(`${baseUrl}/api/users/${testAdvertiserWallet}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.walletAddress, testAdvertiserWallet.toLowerCase());
      assert.ok(Array.isArray(data.campaigns), 'Campaigns relation must be an array');
    });

    await test('GET /api/users/:walletAddress returns 404 for unknown wallet', async () => {
      const unknownWallet = 'GA7QW5KXGPTR4N2K9J2L77XLMESCROW9999STORMTESTNET999999999';
      const res = await fetch(`${baseUrl}/api/users/${unknownWallet}`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, 'User not found');
    });

    // ----------------------------------------------------
    // 4. Campaign Lifecycle Endpoints
    // ----------------------------------------------------
    let createdCampaignId = '';
    const uniqueOnChainId = `soroban-${Date.now()}`;

    await test('POST /api/campaigns creates campaign with valid metadata', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Web3 Ledger Analytics Pro',
          description: 'High-speed affiliate campaign with Soroban smart contract budget escrow',
          tags: 'stellar,soroban,analytics,escrow',
          onChainId: uniqueOnChainId,
          advertiserWallet: testAdvertiserWallet,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.title, 'Web3 Ledger Analytics Pro');
      assert.strictEqual(data.onChainId, uniqueOnChainId);
      assert.ok(data.id, 'Created campaign must return UUID');
      createdCampaignId = data.id;
    });

    await test('POST /api/campaigns rejects short title and short description with 400', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'X',
          description: 'short',
          tags: 'tag',
          onChainId: `onchain-${Date.now()}`,
          advertiserWallet: testAdvertiserWallet,
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error, 'Validation error array must be returned');
    });

    await test('GET /api/campaigns lists all active campaigns', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data), 'Campaign list must be an array');
      assert.ok(data.length >= 1, 'At least 1 campaign should be listed');
      const found = data.find((c: any) => c.id === createdCampaignId);
      assert.ok(found, 'Newly created campaign should be in the list');
      assert.ok(found.advertiser, 'Advertiser relation must be populated');
    });

    await test('GET /api/campaigns/:id returns specific campaign by UUID', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, createdCampaignId);
      assert.strictEqual(data.title, 'Web3 Ledger Analytics Pro');
      assert.ok(data.advertiser, 'Advertiser relation must be joined');
    });

    await test('GET /api/campaigns/:id returns 404 for non-existent UUID', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${baseUrl}/api/campaigns/${nonExistentUuid}`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, 'Campaign not found');
    });

    console.log('\n======================================================');
    console.log(`🎉 All ${passedTests}/${totalTests} API Endpoints Integration Tests Passed Successfully!`);
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

// Execute tests
runApiIntegrationTests().catch((err) => {
  console.error('\n❌ API Integration Tests Failed:', err);
  process.exit(1);
});
