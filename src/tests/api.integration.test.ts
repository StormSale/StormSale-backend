process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import { app } from '../app';

async function runApiIntegrationTests() {
  console.log('\n======================================================');
  console.log('🚀 StormSale Backend Production API Integration Test Suite');
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
    const testRecruiterWallet = 'GCLXJ7D53VN4CWWY4Q3J7JFLBZZWEMDGYZZ677X64M35G4WWTEST2222';

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
    // 4. Campaign Lifecycle & Audience Separation
    // ----------------------------------------------------
    let createdCampaignId = '';
    const uniqueOnChainId = `soroban-${Date.now()}`;

    await test('POST /api/campaigns creates campaign with B2B audience metadata', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Web3 Enterprise Lead Gen',
          description: 'B2B enterprise affiliate campaign with Soroban smart contract budget escrow',
          tags: 'stellar,soroban,enterprise,b2b',
          onChainId: uniqueOnChainId,
          advertiserWallet: testAdvertiserWallet,
          audience: 'B2B',
          budget: 5000.0,
          currency: 'XLM',
          commissionRate: 15.0,
          clearingPeriod: 172800,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.title, 'Web3 Enterprise Lead Gen');
      assert.strictEqual(data.audience, 'B2B');
      assert.strictEqual(data.commissionRate, 15.0);
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

    await test('GET /api/campaigns lists campaigns with audience filtering', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns?audience=B2B`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data), 'Campaign list must be an array');
      assert.ok(data.length >= 1, 'At least 1 B2B campaign should be listed');
      const found = data.find((c: any) => c.id === createdCampaignId);
      assert.ok(found, 'Newly created campaign should be in the list');
      assert.strictEqual(found.audience, 'B2B');
    });

    await test('GET /api/campaigns/:id returns specific campaign by UUID', async () => {
      const res = await fetch(`${baseUrl}/api/campaigns/${createdCampaignId}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, createdCampaignId);
      assert.strictEqual(data.title, 'Web3 Enterprise Lead Gen');
      assert.ok(data.advertiser, 'Advertiser relation must be joined');
    });

    // ----------------------------------------------------
    // 5. B2B Multi-Seat Organizations & RBAC
    // ----------------------------------------------------
    let testOrgId = '';
    let addedMemberId = '';
    const testMemberWallet = 'GMEMBER' + '2'.repeat(49);

    await test('POST /api/organizations creates enterprise organization with owner', async () => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Stellar Growth Labs Corp',
          ownerAddress: testAdvertiserWallet,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.name, 'Stellar Growth Labs Corp');
      assert.strictEqual(data.ownerAddress, testAdvertiserWallet.toLowerCase());
      assert.ok(data.id, 'Organization ID must be returned');
      testOrgId = data.id;
    });

    await test('GET /api/organizations/:id retrieves organization with team members', async () => {
      const res = await fetch(`${baseUrl}/api/organizations/${testOrgId}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, testOrgId);
      assert.ok(Array.isArray(data.members), 'Members array must be populated');
      assert.strictEqual(data.members[0].role, 'ADMIN');
    });

    await test('POST /api/organizations/:id/members adds team member with MARKETING_MANAGER role', async () => {
      const res = await fetch(`${baseUrl}/api/organizations/${testOrgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: testMemberWallet,
          name: 'Alex Director',
          role: 'MARKETING_MANAGER',
          addedBy: testAdvertiserWallet,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.walletAddress, testMemberWallet.toLowerCase());
      assert.strictEqual(data.role, 'MARKETING_MANAGER');
      assert.ok(data.id, 'Member ID must be returned');
      addedMemberId = data.id;
    });

    await test('DELETE /api/organizations/:id/members/:memberId removes team member', async () => {
      const res = await fetch(`${baseUrl}/api/organizations/${testOrgId}/members/${addedMemberId}`, {
        method: 'DELETE',
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.removedMemberId, addedMemberId);
    });

    // ----------------------------------------------------
    // 6. B2C Two-Tier Referral Network
    // ----------------------------------------------------
    await test('POST /api/referrals registers two-tier recruiter relationship', async () => {
      const res = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterAddress: testRecruiterWallet,
          childAddress: testAffiliateWallet,
          tier: 1,
          overrideRatePercent: 2.0,
          directCommissionRatePercent: 8.0,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.recruiterAddress, testRecruiterWallet.toLowerCase());
      assert.strictEqual(data.childAddress, testAffiliateWallet.toLowerCase());
      assert.strictEqual(data.overrideRatePercent, 2.0);
    });

    await test('POST /api/referrals rejects self-recruitment', async () => {
      const res = await fetch(`${baseUrl}/api/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterAddress: testRecruiterWallet,
          childAddress: testRecruiterWallet,
        }),
      });

      assert.strictEqual(res.status, 400);
    });

    await test('GET /api/referrals/recruiter/:recruiterAddress returns 2-tier tree summary', async () => {
      const res = await fetch(`${baseUrl}/api/referrals/recruiter/${testRecruiterWallet}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.masterAddress, testRecruiterWallet.toLowerCase());
      assert.strictEqual(data.directRecruitsCount, 1);
      assert.ok(Array.isArray(data.tree), 'Tree array must be present');
    });

    await test('POST /api/referrals/commission-split computes 80/20 direct and override split', async () => {
      const res = await fetch(`${baseUrl}/api/referrals/commission-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleAmountXlm: 1000,
          totalCommissionRatePercent: 10,
          sellingAffiliateAddress: testAffiliateWallet,
          recruiterAddress: testRecruiterWallet,
          overrideRatePercent: 2,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.totalCommissionXlm, 100);
      assert.strictEqual(data.sellingAffiliateCommissionXlm, 80);
      assert.strictEqual(data.recruiterOverrideCommissionXlm, 20);
      assert.strictEqual(data.sellingAffiliateStroops, '800000000');
      assert.strictEqual(data.recruiterOverrideStroops, '200000000');
      assert.strictEqual(data.splitRatioLabel, '80% / 20%');
    });

    // ----------------------------------------------------
    // 7. Fraud Risk Scoring & Anomaly Velocity Telemetry
    // ----------------------------------------------------
    await test('POST /api/fraud/eval classifies normal velocity conversion as LOW risk', async () => {
      const now = Date.now();
      const res = await fetch(`${baseUrl}/api/fraud/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: createdCampaignId,
          affiliateAddress: testAffiliateWallet,
          clickTimestamp: new Date(now - 60000).toISOString(),
          conversionTimestamp: new Date(now).toISOString(),
          ipHash: 'a1b2c3d4e5f6g7h8i9j0',
          velocityPerMinute: 2.1,
          campaignMeanVelocity: 2.0,
          campaignStdDev: 1.0,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.riskLevel, 'LOW');
      assert.strictEqual(data.isAnomaly, false);
    });

    await test('POST /api/fraud/eval detects instant click-to-conversion anomaly (<2s)', async () => {
      const now = Date.now();
      const res = await fetch(`${baseUrl}/api/fraud/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: createdCampaignId,
          affiliateAddress: testAffiliateWallet,
          clickTimestamp: new Date(now - 1200).toISOString(), // 1.2 seconds delta
          conversionTimestamp: new Date(now).toISOString(),
          ipHash: 'bot_ip_hash_987654321',
          velocityPerMinute: 2.0,
          campaignMeanVelocity: 2.0,
          campaignStdDev: 1.0,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.riskLevel, 'HIGH');
      assert.strictEqual(data.isAnomaly, true);
    });

    await test('POST /api/fraud/affiliate/:wallet/pause toggles affiliate pause status', async () => {
      const res = await fetch(`${baseUrl}/api/fraud/affiliate/${testAffiliateWallet}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPaused: true,
          reason: 'Excessive bot velocity anomalies detected',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.isPaused, true);
    });

    // ----------------------------------------------------
    // 8. Tracked Short Links
    // ----------------------------------------------------
    const customSlug = `storm-${Date.now().toString(36)}`;
    await test('POST /api/links creates customized tracked short link', async () => {
      const res = await fetch(`${baseUrl}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: customSlug,
          targetUrl: 'https://stormsale.io/deal/enterprise-annual',
          campaignId: createdCampaignId,
          affiliateWallet: testAffiliateWallet,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.slug, customSlug.toLowerCase());
      assert.strictEqual(data.clicksCount, 0);
    });

    await test('GET /api/links/:slug resolves short link and increments click counter', async () => {
      const res = await fetch(`${baseUrl}/api/links/${customSlug}?subId=twitter_ad`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.slug, customSlug.toLowerCase());
      assert.strictEqual(data.clicksCount, 1);
    });

    // ----------------------------------------------------
    // 9. Enterprise B2B Webhook Integrations
    // ----------------------------------------------------
    let webhookId = '';
    await test('POST /api/webhooks registers webhook endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: testOrgId,
          name: 'Stellar Mainnet CRM Webhook',
          url: 'https://crm.example.com/api/stormsale-events',
          events: ['campaign.created', 'conversion.created', 'payout.claimed'],
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.secret.startsWith('whsec_'), 'Secret must have whsec_ prefix');
      assert.strictEqual(data.organizationId, testOrgId);
      webhookId = data.id;
    });

    await test('POST /api/webhooks/:id/test-ping dispatches signed ping event', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/${webhookId}/test-ping`, {
        method: 'POST',
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'delivered');
      assert.ok(data.signatureHeader.includes('v1='), 'HMAC signature header must be present');
      assert.strictEqual(data.payload.event, 'ping.test');
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
