import assert from 'assert';
import http from 'http';
import { app } from '../app';
import { operatorAuditEmitter, OperatorDelegationAuditLog } from '../services/organization.service';

export async function runOperatorDelegationTests(): Promise<void> {
  process.env.NODE_ENV = 'test';

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const ownerWallet = 'G' + 'E'.repeat(55);
  const otherOrgOwnerWallet = 'G' + 'F'.repeat(55);
  const managerWallet = 'G' + 'G'.repeat(55);
  const editorWallet = 'G' + 'H'.repeat(55);
  const viewerWallet = 'G' + 'I'.repeat(55);
  const financeWallet = 'G' + 'J'.repeat(55);
  const pendingWallet = 'G' + 'K'.repeat(55);
  const outsiderWallet = 'G' + 'L'.repeat(55);

  const emittedAuditEvents: OperatorDelegationAuditLog[] = [];
  const onAudit = (entry: OperatorDelegationAuditLog) => {
    emittedAuditEvents.push(entry);
  };
  operatorAuditEmitter.on('campaign.operator.nominated', onAudit);

  try {
    // 1. Create primary organization and rival organization
    const orgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Delegation Org',
        ownerAddress: ownerWallet,
      }),
    });
    assert.strictEqual(orgRes.status, 201);
    const org = (await orgRes.json()) as { id: string };

    const otherOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rival Enterprise Org',
        ownerAddress: otherOrgOwnerWallet,
      }),
    });
    assert.strictEqual(otherOrgRes.status, 201);
    const otherOrg = (await otherOrgRes.json()) as { id: string };

    // 2. Add verified MARKETING_MANAGER, EDITOR, VIEWER, FINANCE, and pending EDITOR
    const membersToCreate = [
      { walletAddress: managerWallet, name: 'Marketing Lead', role: 'MARKETING_MANAGER', status: 'verified' },
      { walletAddress: editorWallet, name: 'Campaign Editor', role: 'EDITOR', status: 'verified' },
      { walletAddress: viewerWallet, name: 'ReadOnly Analyst', role: 'VIEWER', status: 'verified' },
      { walletAddress: financeWallet, name: 'Finance Controller', role: 'FINANCE', status: 'verified' },
      { walletAddress: pendingWallet, name: 'Unverified Editor', role: 'EDITOR', status: 'pending' },
    ];

    for (const member of membersToCreate) {
      const mRes = await fetch(`${baseUrl}/api/organizations/${org.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...member,
          addedBy: ownerWallet,
        }),
      });
      assert.strictEqual(mRes.status, 201);
    }

    // 3. Create B2B campaign bound to primary organization + rival campaign bound to rival org
    const campaignRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Delegated Operator Enterprise Campaign',
        description: 'B2B campaign testing Soroban set_campaign_operator permission guard',
        tags: 'b2b,operator,soroban',
        onChainId: 'storm-camp-op-15',
        advertiserWallet: ownerWallet,
        audience: 'B2B',
        organizationId: org.id,
      }),
    });
    assert.strictEqual(campaignRes.status, 201);
    const campaign = (await campaignRes.json()) as { id: string; onChainId: string };

    const rivalCampaignRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Rival Organization Campaign',
        description: 'Campaign owned by rival tenant organization',
        tags: 'b2b,rival',
        onChainId: 'storm-camp-rival-99',
        advertiserWallet: otherOrgOwnerWallet,
        audience: 'B2B',
        organizationId: otherOrg.id,
      }),
    });
    assert.strictEqual(rivalCampaignRes.status, 201);
    const rivalCampaign = (await rivalCampaignRes.json()) as { id: string };

    // 4. Rejects wallet not in organization (403 NOT_TEAM_MEMBER)
    const outsiderRes = await fetch(
      `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAddress: outsiderWallet, nominatedBy: ownerWallet }),
      }
    );
    assert.strictEqual(outsiderRes.status, 403);
    const outsiderErr = (await outsiderRes.json()) as { code: string };
    assert.strictEqual(outsiderErr.code, 'NOT_TEAM_MEMBER');

    // 5. Rejects unverified (pending) organization member (403 UNVERIFIED_TEAM_MEMBER)
    const pendingRes = await fetch(
      `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAddress: pendingWallet, nominatedBy: ownerWallet }),
      }
    );
    assert.strictEqual(pendingRes.status, 403);
    const pendingErr = (await pendingRes.json()) as { code: string };
    assert.strictEqual(pendingErr.code, 'UNVERIFIED_TEAM_MEMBER');

    // 6. Rejects VIEWER and FINANCE roles lacking campaign:edit or sale:log (403 INSUFFICIENT_ROLE_CAPABILITY)
    for (const insufficientWallet of [viewerWallet, financeWallet]) {
      const deniedRes = await fetch(
        `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorAddress: insufficientWallet, nominatedBy: ownerWallet }),
        }
      );
      assert.strictEqual(deniedRes.status, 403);
      const deniedErr = (await deniedRes.json()) as { code: string };
      assert.strictEqual(deniedErr.code, 'INSUFFICIENT_ROLE_CAPABILITY');
    }

    // 7. Rejects cross-organization campaign delegation attempt (403 CAMPAIGN_ORG_MISMATCH)
    const crossOrgRes = await fetch(
      `${baseUrl}/api/organizations/${org.id}/campaigns/${rivalCampaign.id}/operator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAddress: managerWallet, nominatedBy: ownerWallet }),
      }
    );
    assert.strictEqual(crossOrgRes.status, 403);
    const crossOrgErr = (await crossOrgRes.json()) as { code: string };
    assert.strictEqual(crossOrgErr.code, 'CAMPAIGN_ORG_MISMATCH');

    // 8. Rejects unauthorized nominator (e.g. VIEWER attempting to delegate)
    const badNominatorRes = await fetch(
      `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAddress: editorWallet, nominatedBy: viewerWallet }),
      }
    );
    assert.strictEqual(badNominatorRes.status, 403);
    const badNominatorErr = (await badNominatorRes.json()) as { code: string };
    assert.strictEqual(badNominatorErr.code, 'UNAUTHORIZED_NOMINATOR');

    // 9. Rejects malformed / EVM wallet address with 400
    const invalidWalletRes = await fetch(
      `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' }),
      }
    );
    assert.strictEqual(invalidWalletRes.status, 400);

    // 10. Succeeds for verified MARKETING_MANAGER and EDITOR, returning Soroban set_campaign_operator params & emitting audit logs
    for (const validOperator of [managerWallet, editorWallet]) {
      const okRes = await fetch(
        `${baseUrl}/api/organizations/${org.id}/campaigns/${campaign.id}/operator`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorAddress: validOperator, nominatedBy: ownerWallet }),
        }
      );
      assert.strictEqual(okRes.status, 200);
      const payload = (await okRes.json()) as {
        operatorAddress: string;
        grantedCapabilities: string[];
        sorobanInvocation: {
          contractMethod: string;
          args: Array<{ name: string; value: string | boolean }>;
        };
        auditLog: { event: string; onChainCampaignId: string };
      };
      assert.strictEqual(payload.operatorAddress, validOperator.toLowerCase());
      assert.ok(payload.grantedCapabilities.includes('campaign:edit'));
      assert.ok(payload.grantedCapabilities.includes('sale:log'));
      assert.strictEqual(payload.sorobanInvocation.contractMethod, 'set_campaign_operator');
      assert.deepStrictEqual(payload.sorobanInvocation.args, [
        { name: 'campaign_id', type: 'symbol', value: 'storm-camp-op-15' },
        { name: 'admin', type: 'address', value: ownerWallet },
        { name: 'operator', type: 'address', value: validOperator },
        { name: 'enabled', type: 'bool', value: true },
      ]);
      assert.strictEqual(payload.auditLog.event, 'campaign.operator.nominated');
      assert.strictEqual(payload.auditLog.onChainCampaignId, 'storm-camp-op-15');
    }

    assert.strictEqual(emittedAuditEvents.length, 2, 'Should emit exactly 2 audit events for valid nominations');

    // 11. Retrieves persisted audit logs via GET /api/organizations/:id/operator-audit-logs
    const auditLogsRes = await fetch(`${baseUrl}/api/organizations/${org.id}/operator-audit-logs`);
    assert.strictEqual(auditLogsRes.status, 200);
    const auditData = (await auditLogsRes.json()) as {
      organizationId: string;
      auditLogs: OperatorDelegationAuditLog[];
    };
    assert.strictEqual(auditData.organizationId, org.id);
    assert.strictEqual(auditData.auditLogs.length, 2);

    console.log('✔ All 11/11 campaign operator delegation guard & audit tests passed!');
  } finally {
    operatorAuditEmitter.off('campaign.operator.nominated', onAudit);
    server.close();
  }
}
