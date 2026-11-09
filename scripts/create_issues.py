import subprocess
import time
import json
import sys

ISSUES = [
    # -------------------------------------------------------------------------
    # Pillar 1: B2B Enterprise Multi-Seat Organizations & RBAC (1 - 18)
    # -------------------------------------------------------------------------
    {
        "title": "feat(b2b): implement SEP-10 challenge-response authentication for enterprise login",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Enterprise B2B clients require non-custodial, cryptographically secure authentication using their Stellar wallets instead of email/passwords. Following Stellar Ecosystem Proposal 10 (SEP-10), the backend must generate a challenge transaction for the organization owner or member to sign.

### Technical Specification
- Create `/api/auth/challenge` generating an invalid time-bounded transaction containing manage_data operations with challenge nonce.
- Create `/api/auth/token` verifying the ed25519 signature of the signer against Horizon network passphrase.
- Return JWT containing `{ walletAddress, orgId, role, capabilities }` with 24h expiration.

### Target Scope
- `src/services/auth.service.ts`
- `src/controllers/auth.controller.ts`
- `src/middlewares/auth.middleware.ts`

### Acceptance Criteria
- [ ] Challenge transaction generated conforms strictly to SEP-10 specification.
- [ ] Valid signature exchanges for signed JWT with organization RBAC claims.
- [ ] Tampered or expired signatures rejected with 401 Unauthorized."""
    },
    {
        "title": "feat(b2b): enforce granular capability checking middleware for organization routes",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "security"],
        "body": """### Context & Motivation
The frontend defines granular capabilities (`campaign:create`, `campaign:edit`, `escrow:refund`, `team:manage`, `analytics:view`). The backend must enforce these capabilities at the middleware layer before executing controller actions.

### Technical Specification
- Create `requireOrgCapability(capability: OrganizationCapability)` middleware.
- Verify user's membership and role in target organization ID from `req.params` or `req.body`.
- Map roles:
  - `ADMIN`: all capabilities
  - `MARKETING_MANAGER`: `campaign:create`, `campaign:edit`, `analytics:view`
  - `EDITOR`: `campaign:edit`, `analytics:view`
  - `FINANCE`: `escrow:refund`, `escrow:refill`, `analytics:view`
  - `VIEWER`: `analytics:view`

### Target Scope
- `src/middlewares/rbac.middleware.ts`
- `src/routes/organization.routes.ts`

### Acceptance Criteria
- [ ] Unauthorized members attempting restricted endpoints receive 403 Forbidden.
- [ ] Admin bypasses check for all organization capabilities.
- [ ] Unit tests cover all 5 roles against permitted and forbidden routes."""
    },
    {
        "title": "feat(b2b): implement organization member invitation flow with cryptographic signature verification",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
When an organization owner invites a new team member, the invitation starts in `pending` status until the invited wallet signs an acceptance challenge proving custody of the private key.

### Technical Specification
- Add `POST /api/organizations/:id/invites` creating pending invitation challenge nonce.
- Add `POST /api/organizations/:id/invites/accept` verifying signature of invite nonce and upgrading member status to `verified`.
- Add `DELETE /api/organizations/:id/invites/:inviteId` to revoke pending invitations.

### Target Scope
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`
- `prisma/schema.prisma`

### Acceptance Criteria
- [ ] Pending members cannot access organization API endpoints until verified.
- [ ] Cryptographic signature verification validates invited wallet address.
- [ ] Revocation cleans up invitation state idempotently."""
    },
    {
        "title": "feat(b2b): add organization profile editing and corporate branding metadata endpoints",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
B2B clients require storing corporate profile details (display name, website URL, brand primary color, logo URL) displayed across their branded affiliate portals.

### Technical Specification
- Add fields `websiteUrl`, `logoUrl`, `brandColor` to `Organization` model in Prisma.
- Implement `PATCH /api/organizations/:id` allowing updates by members with `team:manage` capability.
- Validate URLs with Zod and sanitize color hex codes (`#RRGGBB`).

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Valid branding updates persist and return 200 OK.
- [ ] Malformed URLs or hex codes return 400 Bad Request.
- [ ] Non-admin callers receive 403 Forbidden."""
    },
    {
        "title": "feat(b2b): implement audit log trail for organization role changes and seat grants",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "database"],
        "body": """### Context & Motivation
Enterprise compliance standards (SOC2, ISO27001) require a tamper-evident audit log recording every permission change, member invitation, role promotion, and seat revocation.

### Technical Specification
- Create `OrgAuditLog` model in Prisma: `{ id, orgId, actorWallet, action, targetWallet, previousRole, newRole, ipAddress, timestamp }`.
- Insert audit record synchronously inside database transaction on any team membership mutation.
- Expose `GET /api/organizations/:id/audit-logs` with pagination and date filtering.

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Adding, updating, or removing members writes audit trail record.
- [ ] Audit logs are immutable (no PUT/DELETE endpoints).
- [ ] Pagination handles 100+ audit log items efficiently."""
    },
    {
        "title": "feat(b2b): add organization-scoped campaign listing and aggregate budget reporting API",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Enterprise marketing teams need an aggregate overview of all active B2B campaigns linked to their organization, including total budget allocated, total escrow deposited, and active affiliate count.

### Technical Specification
- Implement `GET /api/organizations/:id/campaigns/summary`.
- Query all campaigns where `organizationId = :id`.
- Calculate aggregate `totalBudgetXlm`, `activeCampaignsCount`, `totalClicks`, `totalConversions`.

### Target Scope
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Endpoint returns structured summary metrics in JSON.
- [ ] Campaigns belonging to other organizations are excluded.
- [ ] Zero-division edge case handled when org has 0 campaigns."""
    },
    {
        "title": "feat(b2b): implement multi-seat transfer of organization ownership with two-step handoff",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Transferring organization ownership is a high-risk operation. A single-step transfer can accidentally lock an enterprise out if a typo occurs in the destination wallet address.

### Technical Specification
- Add `pendingOwnerAddress` and `transferInitiatedAt` to `Organization` model.
- Implement `POST /api/organizations/:id/transfer/initiate` (callable only by current owner).
- Implement `POST /api/organizations/:id/transfer/claim` (callable only by nominated pending owner).
- Implement `POST /api/organizations/:id/transfer/cancel` (callable by current owner to abort).

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Ownership transfer only finalizes when nominated wallet signs claim request.
- [ ] Previous owner automatically demoted to `ADMIN` upon claim.
- [ ] Unclaimed transfer expires automatically after 72 hours."""
    },
    {
        "title": "feat(b2b): support corporate tax identification and billing address fields on Organization model",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "database"],
        "body": """### Context & Motivation
B2B accounting requires corporate billing details (Tax ID / VAT number, registered company name, billing street address, country) for invoicing affiliate disbursements.

### Technical Specification
- Add `taxId`, `legalEntityName`, `billingAddress`, `countryCode` fields to Prisma schema.
- Validate ISO-3166-1 alpha-2 country codes with Zod.
- Expose update endpoint under `PUT /api/organizations/:id/billing`.

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Billing info persists and validates country codes correctly.
- [ ] FINANCE and ADMIN roles can edit billing data; VIEWER cannot.
- [ ] Unit tests verify validation logic."""
    },
    {
        "title": "feat(b2b): implement bulk team member invitation endpoint with CSV batching",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Large enterprises onboarding 50+ marketing team members need a bulk invitation endpoint rather than adding members one by one.

### Technical Specification
- Implement `POST /api/organizations/:id/members/bulk`.
- Accept array of `{ walletAddress, name, role }` (up to 100 items per batch).
- Run transactional database batch insert, skipping already-existing members with informative result report.

### Target Scope
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Returns `{ added: count, skipped: count, errors: [] }`.
- [ ] Invalid Stellar addresses in the list do not abort valid entries.
- [ ] Rejects batch size exceeding 100 with 400 Bad Request."""
    },
    {
        "title": "feat(b2b): create permission guard for smart contract campaign operator delegation",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2b", "security"],
        "body": """### Context & Motivation
In `Storm-Contract`, B2B campaigns support `set_campaign_operator` allowing delegated wallets to log conversions. The backend must enforce that only verified organization members with `campaign:edit` or `sale:log` can be designated as on-chain operators.

### Technical Specification
- Implement `POST /api/organizations/:id/campaigns/:campaignId/operator`.
- Verify the candidate operator wallet belongs to the organization and holds the `sale:log` or `campaign:edit` capability.
- Generate Soroban invocation parameters for `set_campaign_operator`.

### Target Scope
- `src/services/organization.service.ts`
- `src/controllers/campaign.controller.ts`

### Acceptance Criteria
- [ ] Rejects wallets not verified as organization team members.
- [ ] Rejects team members with insufficient role (e.g. VIEWER).
- [ ] Emits audit log entry upon successful operator nomination."""
    },
    {
        "title": "feat(b2b): add session expiration and revokable API keys for organization automated services",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Enterprise clients require machine-to-machine API keys to automate conversion logging and webhook subscription configuration from their backend servers.

### Technical Specification
- Create `ApiKey` model: `{ id, organizationId, keyHash, name, prefix, scopes, expiresAt, lastUsedAt }`.
- Generate secure random token `storm_live_<hex>`, store only argon2/sha256 hash.
- Implement API key authentication middleware checking bearer token prefix and signature.

### Target Scope
- `prisma/schema.prisma`
- `src/services/apikey.service.ts`
- `src/middlewares/apikey.middleware.ts`

### Acceptance Criteria
- [ ] Full plaintext API key shown only once at creation time.
- [ ] Expired or revoked API keys rejected with 401 Unauthorized.
- [ ] Scopes strictly enforced according to configured key permissions."""
    },
    {
        "title": "feat(b2b): implement organization workspace switching endpoint for multi-tenant users",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Affiliate agency managers may be members of multiple enterprise organizations. The backend must provide an endpoint to list all memberships and switch active workspace context.

### Technical Specification
- Implement `GET /api/users/:walletAddress/organizations` returning all orgs where user is owner or team member.
- Include user's specific role and capabilities within each organization.

### Target Scope
- `src/services/organization.service.ts`
- `src/controllers/organization.controller.ts`

### Acceptance Criteria
- [ ] Returns array of organizations with user role in each.
- [ ] Displays both owned organizations and invited memberships.
- [ ] Response is cached or optimized to prevent N+1 database queries."""
    },
    {
        "title": "feat(b2b): finance manager approval workflow for campaign budget increases",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
In enterprise environments, marketing managers can draft campaign budget increases, but only users with the `FINANCE` or `ADMIN` role can approve and trigger the on-chain refill transaction.

### Technical Specification
- Create `BudgetIncreaseRequest` model: `{ id, campaignId, requestedAmount, requesterWallet, status: 'pending'|'approved'|'rejected', approverWallet }`.
- Implement `POST /api/campaigns/:id/budget-requests`.
- Implement `POST /api/campaigns/:id/budget-requests/:requestId/approve` (FINANCE/ADMIN only).

### Target Scope
- `prisma/schema.prisma`
- `src/services/campaign.service.ts`
- `src/controllers/campaign.controller.ts`

### Acceptance Criteria
- [ ] Non-finance members cannot approve budget requests.
- [ ] Approved request generates valid smart contract `refill_escrow` parameters.
- [ ] Status updates and rejection notes are persisted."""
    },
    {
        "title": "feat(b2b): editor role restricted from modifying clearing periods and commission rates",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Enterprise security rules dictate that while content editors can update campaign titles, descriptions, and tags, they must never alter financial parameters (`commissionRate`, `clearingPeriod`).

### Technical Specification
- In `CampaignController.updateCampaign`, inspect user's organization role.
- If role is `EDITOR`, strip `commissionRate` and `clearingPeriod` from update payload, or return 403 if explicitly supplied.

### Target Scope
- `src/controllers/campaign.controller.ts`
- `src/services/campaign.service.ts`

### Acceptance Criteria
- [ ] Editors successfully update title and description.
- [ ] Editors attempting to change commissionRate receive 403 Forbidden.
- [ ] Admin and Marketing Managers can update all fields."""
    },
    {
        "title": "feat(b2b): organization member activity heartbeat and session revocation",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Enterprise administrators need visibility into active sessions across their team members and the ability to immediately terminate an active session if a device is compromised.

### Technical Specification
- Add `lastSeenAt` and `activeSessionJti` to `TeamMember` model.
- Implement heartbeat route `POST /api/organizations/:id/heartbeat`.
- Implement `POST /api/organizations/:id/members/:memberId/revoke-session` adding session JTI to Redis blacklist.

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`
- `src/middlewares/auth.middleware.ts`

### Acceptance Criteria
- [ ] Heartbeat updates lastSeenAt timestamp.
- [ ] Revoked session JTI is immediately rejected on subsequent requests.
- [ ] Non-admin callers cannot revoke other members' sessions."""
    },
    {
        "title": "feat(b2b): soft-delete and archival mechanism for inactive enterprise organizations",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "database"],
        "body": """### Context & Motivation
To preserve historical audit records and financial transactions, enterprise organizations must never be hard-deleted from PostgreSQL. A soft-delete status flag must be used.

### Technical Specification
- Add `deletedAt DateTime?` and `isArchived Boolean @default(false)` to `Organization` model.
- Update all queries to filter out archived organizations unless `includeArchived=true` is requested by system auditor.
- Implement `DELETE /api/organizations/:id` marking `deletedAt = now()` and canceling active webhooks.

### Target Scope
- `prisma/schema.prisma`
- `src/services/organization.service.ts`

### Acceptance Criteria
- [ ] Soft-deleted organization is omitted from default listings.
- [ ] Webhook deliveries and API keys linked to deleted organization are deactivated.
- [ ] Database record is preserved for compliance auditing."""
    },
    {
        "title": "feat(b2b): enterprise role assignment notification webhooks",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
When enterprise team member roles are altered, enterprise Slack or SIEM integration webhooks must be notified immediately of the security event.

### Technical Specification
- Trigger internal event `team.member_role_updated` on role update.
- Dispatch webhook payload `{ event: 'team.member_role_updated', orgId, memberWallet, oldRole, newRole, actorWallet }`.

### Target Scope
- `src/services/organization.service.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Webhook event queued on role changes.
- [ ] Payload includes actor and target wallet metadata.
- [ ] Failure to deliver webhook does not rollback database transaction."""
    },
    {
        "title": "test(b2b): comprehensive test suite for multi-seat organization role transitions",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "testing"],
        "body": """### Context & Motivation
Robust test coverage is mandatory to guarantee that organization RBAC invariants cannot be bypassed through parameter tampering or privilege escalation.

### Technical Specification
- Add integration test suite `src/tests/organization.rbac.test.ts`.
- Test role transition matrix: VIEWER -> EDITOR -> MARKETING_MANAGER -> ADMIN.
- Verify each role against 10 critical endpoints.

### Target Scope
- `src/tests/organization.rbac.test.ts`

### Acceptance Criteria
- [ ] 100% of defined organization roles tested against capability matrix.
- [ ] Privilege escalation attempts properly fail with 403 Forbidden.
- [ ] All tests pass cleanly in CI environment."""
    },

    # -------------------------------------------------------------------------
    # Pillar 2: B2B Webhook Engine, Postback Queues & Enterprise APIs (19 - 34)
    # -------------------------------------------------------------------------
    {
        "title": "feat(b2b): BullMQ / Redis asynchronous delivery queue for webhook postbacks",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2b", "infra"],
        "body": """### Context & Motivation
Webhook deliveries must never block synchronous HTTP response threads. An asynchronous queue using BullMQ and Redis is required to process deliveries with concurrency control.

### Technical Specification
- Implement `WebhookDeliveryQueue` using BullMQ.
- Worker processes jobs with concurrency limit of 10 per organization.
- Support delayed retries and failure event hooks.

### Target Scope
- `src/queues/webhook.queue.ts`
- `src/workers/webhook.worker.ts`

### Acceptance Criteria
- [ ] Webhook dispatch returns immediately (<5ms) after queuing job.
- [ ] Queue worker processes jobs asynchronously.
- [ ] Graceful shutdown drains queue without dropping events."""
    },
    {
        "title": "feat(b2b): HMAC-SHA256 timestamped signature verification headers for webhooks",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Enterprise webhook receivers must be able to verify that payloads originated from StormSale and have not been tampered with or replayed by attackers.

### Technical Specification
- Format signature header: `StormSale-Signature: t={timestamp},v1={hmac_sha256}`.
- Hash computation: `HMAC_SHA256(secret, t + "." + JSON.stringify(payload))`.
- Document verification code snippet in Go, Python, and TypeScript for merchants.

### Target Scope
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Signature header generated matches standard Stripe/GitHub webhook signature pattern.
- [ ] Timestamp included in HMAC payload to prevent replay attacks.
- [ ] Constant-time comparison recommended in merchant verification docs."""
    },
    {
        "title": "feat(b2b): exponential backoff and retry policy for failed webhook deliveries",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
When an enterprise destination server experiences temporary downtime, webhooks should not be dropped immediately. A retry schedule with exponential backoff is required.

### Technical Specification
- Configure 5 retry attempts: 1m, 5m, 30m, 2h, 8h.
- Calculate `nextRetryAt` timestamp on each failed attempt.
- Track attempt status (`retrying`, `failed`, `delivered`) in `WebhookDelivery` log.

### Target Scope
- `src/services/webhook.service.ts`
- `prisma/schema.prisma`

### Acceptance Criteria
- [ ] Consecutive failures trigger next scheduled retry with exponential delay.
- [ ] 2xx HTTP response terminates retry schedule and marks delivered.
- [ ] Max attempts reached transitions status to `failed`."""
    },
    {
        "title": "feat(b2b): webhook delivery attempt logging with status code and latency tracking",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "database"],
        "body": """### Context & Motivation
Merchants debugging webhook integrations require visibility into response HTTP status codes, execution duration in milliseconds, and error stack traces.

### Technical Specification
- Create `WebhookDeliveryLog` model: `{ id, webhookId, attemptNumber, statusCode, durationMs, errorMsg, createdAt }`.
- Record delivery telemetry for each HTTP request attempt.
- Expose `GET /api/webhooks/:id/deliveries` with query filtering.

### Target Scope
- `prisma/schema.prisma`
- `src/services/webhook.service.ts`
- `src/controllers/webhook.controller.ts`

### Acceptance Criteria
- [ ] HTTP response status code and execution duration recorded.
- [ ] Failed requests store truncated error response body (up to 2KB).
- [ ] Deliveries endpoint supports pagination."""
    },
    {
        "title": "feat(b2b): dead letter queue and alert threshold for persistent webhook failures",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "infra"],
        "body": """### Context & Motivation
When a merchant webhook endpoint fails continuously across all retry attempts, jobs must be moved to a Dead Letter Queue (DLQ) to prevent queue starvation.

### Technical Specification
- Configure BullMQ DLQ for exhausted webhook deliveries.
- Increment `failureCount` on `WebhookEndpoint`.
- If `failureCount > 20`, trigger email alert or dashboard warning to organization owner.

### Target Scope
- `src/queues/webhook.queue.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Exhausted jobs move to dead letter queue without throwing unhandled exceptions.
- [ ] Organization failure count increments correctly.
- [ ] Admin alert triggered on threshold breach."""
    },
    {
        "title": "feat(b2b): interactive webhook payload test-dispatch and simulation endpoint",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Developers integrating with StormSale webhooks need to send simulated test events (`conversion.created`, `campaign.funded`) to their test environments directly from the dashboard.

### Technical Specification
- Implement `POST /api/webhooks/:id/simulate`.
- Accept `{ eventType: WebhookEventType, payloadOverride?: object }`.
- Dispatch payload synchronously or via queue and return HTTP response immediately.

### Target Scope
- `src/controllers/webhook.controller.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Dispatches simulated payload with valid HMAC signature.
- [ ] Returns destination HTTP status code and response body to caller.
- [ ] Rejects unsupported event types with 400 Bad Request."""
    },
    {
        "title": "feat(b2b): automatic webhook endpoint circuit breaker on consecutive 5xx responses",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "performance"],
        "body": """### Context & Motivation
If a merchant endpoint is returning HTTP 500/503 errors repeatedly, hammering it degrades both StormSale and merchant infrastructure. A circuit breaker pattern must temporarily suspend delivery.

### Technical Specification
- Implement circuit breaker:
  - 10 consecutive 5xx errors -> state: OPEN (delivery paused for 15 minutes).
  - After 15 minutes -> state: HALF-OPEN (1 probe request allowed).
  - Successful probe -> state: CLOSED (normal delivery resumes).

### Target Scope
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Circuit breaker opens after 10 consecutive 5xx failures.
- [ ] Subsequent webhooks are queued rather than executed while circuit is open.
- [ ] Successful probe re-closes circuit breaker."""
    },
    {
        "title": "feat(b2b): support custom HTTP authorization headers for webhook destinations",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "security"],
        "body": """### Context & Motivation
Some enterprise webhook destinations require static bearer tokens or custom headers (e.g. `X-Custom-Auth`, `Authorization: Bearer <token>`) in addition to HMAC signature validation.

### Technical Specification
- Add `customHeaders Json?` field to `WebhookEndpoint` model in Prisma.
- Securely encrypt header values at rest using AES-256-GCM.
- Inject decrypted headers into outgoing HTTP POST requests.

### Target Scope
- `prisma/schema.prisma`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Custom headers included in outgoing webhook dispatch requests.
- [ ] Sensitive header values are never logged in plaintext.
- [ ] Malformed header JSON is rejected upon webhook registration."""
    },
    {
        "title": "feat(b2b): webhook event filtering by campaign ID and audience type",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Enterprise clients often have separate CRM systems for B2B vs B2C campaigns. Webhook endpoints must support filtering by audience type or specific campaign IDs.

### Technical Specification
- Add `filterCampaignIds String?` and `filterAudience AudienceType?` to `WebhookEndpoint`.
- Before dispatching event, evaluate if event campaign and audience match filter criteria.
- Skip delivery cleanly if filter criteria are not met.

### Target Scope
- `prisma/schema.prisma`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Webhook configured for B2B only receives B2B campaign events.
- [ ] Webhook configured for specific campaign ID ignores other campaigns.
- [ ] Empty filter receives all organization events by default."""
    },
    {
        "title": "feat(b2b): payload schema versioning for backward-compatible webhook consumers",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
As the StormSale protocol evolves, webhook payload schemas will be updated. Existing enterprise integrations must remain backward-compatible through explicit version negotiation.

### Technical Specification
- Add `apiVersion String @default('2026-11-01')` to `WebhookEndpoint`.
- Implement payload serializer factory rendering version-specific JSON structures.
- Include `StormSale-Version: <apiVersion>` header in outgoing requests.

### Target Scope
- `src/services/webhook.service.ts`
- `src/serializers/webhook.serializer.ts`

### Acceptance Criteria
- [ ] Webhook delivers schema matching endpoint's configured apiVersion.
- [ ] Default apiVersion assigned to newly registered endpoints.
- [ ] Version header present in all outgoing deliveries."""
    },
    {
        "title": "feat(b2b): conversion ingestion postback endpoint for external CRM / ERP systems",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
B2B sales cycles often close offline or inside enterprise CRM systems (HubSpot, Salesforce). An enterprise postback API is needed to log completed conversions.

### Technical Specification
- Implement `POST /api/conversions/postback`.
- Authenticate via organization API key.
- Accept `{ campaignId, clickId, customerRef, saleAmount, currency, metadata }`.
- Queue on-chain conversion logging job for campaign operator.

### Target Scope
- `src/controllers/conversion.controller.ts`
- `src/services/conversion.service.ts`

### Acceptance Criteria
- [ ] Valid postback creates conversion record and triggers smart contract logger.
- [ ] Duplicate customerRef rejected with 409 Conflict.
- [ ] Rejects requests missing valid API key authentication."""
    },
    {
        "title": "feat(b2b): idempotent conversion ingestion using merchant external reference IDs",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "database"],
        "body": """### Context & Motivation
Network retries from enterprise CRMs can cause duplicate conversion submissions. Idempotency must be guaranteed using merchant-supplied idempotency keys.

### Technical Specification
- Check `Idempotency-Key` HTTP header on conversion submission.
- Cache idempotency key and response in Redis for 24 hours.
- If duplicate key received within 24h, return cached response with `Idempotent-Replay: true`.

### Target Scope
- `src/middlewares/idempotency.middleware.ts`
- `src/controllers/conversion.controller.ts`

### Acceptance Criteria
- [ ] Identical request with same idempotency key returns identical status and body.
- [ ] Second request does not double-charge campaign budget or create duplicate sale.
- [ ] Keys expire automatically after TTL."""
    },
    {
        "title": "feat(b2b): webhook endpoint rotation for secret keys with dual-verification grace period",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2b", "security"],
        "body": """### Context & Motivation
When rotating webhook secrets in enterprise environments, a dual-secret grace period is required so merchant servers can update their secrets without downtime.

### Technical Specification
- Add `previousSecret String?` and `secretExpiresAt DateTime?` to `WebhookEndpoint`.
- Implement `POST /api/webhooks/:id/rotate-secret` setting grace period (default 24h).
- Sign payloads with new secret, but merchant verification library can accept either valid secret during grace window.

### Target Scope
- `prisma/schema.prisma`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Old secret remains stored until grace window expires.
- [ ] New secret immediately available in dashboard response.
- [ ] Expired old secrets cleanly purged by cleanup worker."""
    },
    {
        "title": "feat(b2b): aggregate webhook health metrics and uptime monitoring endpoint",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "performance"],
        "body": """### Context & Motivation
Enterprise administrators need visibility into webhook delivery success rates (e.g. 99.4% delivered, 0.6% failed) and average round-trip latency.

### Technical Specification
- Implement `GET /api/organizations/:id/webhooks/metrics`.
- Compute aggregate delivery count, success rate percentage, p95 latency, and current queue depth.

### Target Scope
- `src/controllers/webhook.controller.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Returns structured metrics object with p95 latency in ms.
- [ ] Calculates delivery success rate over last 24h, 7d, and 30d.
- [ ] Queries optimized to run in under 50ms."""
    },
    {
        "title": "feat(b2b): automated webhook replay API for missed event windows",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "api"],
        "body": """### Context & Motivation
If an enterprise client experienced prolonged server maintenance, they need the ability to re-deliver all historical events that occurred during a specific time window.

### Technical Specification
- Implement `POST /api/webhooks/:id/replay`.
- Accept `{ fromTimestamp: ISOString, toTimestamp: ISOString, eventTypes?: string[] }`.
- Find all historical events within window and re-enqueue for delivery.

### Target Scope
- `src/controllers/webhook.controller.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Replays matching events in chronological order.
- [ ] Caps replay window to maximum 7 days in the past.
- [ ] Requires ADMIN or MARKETING_MANAGER capability."""
    },
    {
        "title": "test(b2b): mock HTTP server integration test suite for webhook delivery pipeline",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2b", "testing"],
        "body": """### Context & Motivation
To test the webhook engine end-to-end without relying on external network services, a mock HTTP receiver must be used in integration test suites.

### Technical Specification
- Create `src/tests/webhook.integration.test.ts`.
- Spin up ephemeral HTTP server with route handlers returning 200, 500, and 503.
- Verify delivery execution, signature header validation, and retry behavior.

### Target Scope
- `src/tests/webhook.integration.test.ts`

### Acceptance Criteria
- [ ] Verifies 200 OK delivery marks status delivered.
- [ ] Verifies 500 Internal Error increments failure count and schedules retry.
- [ ] Verifies HMAC signature computed matches receiver validation."""
    },

    # -------------------------------------------------------------------------
    # Pillar 3: B2C Two-Tier Referral Architecture & Tree Engine (35 - 52)
    # -------------------------------------------------------------------------
    {
        "title": "feat(b2c): recursive CTE Prisma query for multi-tier affiliate referral trees",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "database"],
        "body": """### Context & Motivation
When an affiliate network scales to thousands of participants, traversing referral trees with iterative queries causes N+1 performance bottlenecks. A PostgreSQL recursive CTE is required.

### Technical Specification
- Implement raw SQL recursive query in `ReferralService.getRecruiterTree`:
  `WITH RECURSIVE referral_tree AS (...)`
- Return full tree structure up to depth 2 with aggregated sales volume and override earnings.

### Target Scope
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Executes in a single database round-trip.
- [ ] Correctly aggregates sales volume across all children.
- [ ] Limits depth strictly to 2 tiers."""
    },
    {
        "title": "feat(b2c): override commission rate bounds validation (max 50% of campaign pool)",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
To prevent master recruiters from capturing unreasonable shares of sub-affiliate earnings, override rates must be capped by protocol business rules.

### Technical Specification
- In `ReferralController.registerReferral`, enforce:
  - `overrideRatePercent >= 0`
  - `overrideRatePercent <= directCommissionRatePercent`
  - `overrideRatePercent + directCommissionRatePercent <= 100`

### Target Scope
- `src/controllers/referral.controller.ts`

### Acceptance Criteria
- [ ] Rejects override rate exceeding direct commission rate with 400.
- [ ] Rejects negative rates.
- [ ] Valid rates pass successfully."""
    },
    {
        "title": "feat(b2c): cycle detection in affiliate recruitment tree to prevent circular loops",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "database"],
        "body": """### Context & Motivation
If affiliate A recruits B, and B recruits C, C must never be allowed to recruit A. A circular loop corrupts commission tree calculations and recursive queries.

### Technical Specification
- In `ReferralService.registerReferral`, traverse existing ancestor path of `recruiterAddress`.
- If `childAddress` is found in the ancestor chain, reject with error "Circular referral loop detected".

### Target Scope
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Detects direct cycles (A recruits B, B recruits A).
- [ ] Detects indirect cycles (A -> B -> C -> A).
- [ ] Rejection returns 400 Bad Request with informative message."""
    },
    {
        "title": "feat(b2c): recruiter link generator with cryptographic affiliate referral tags",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Affiliates sharing invitations to recruit sub-affiliates need shareable referral URLs containing signed recruiter tracking tags.

### Technical Specification
- Implement `POST /api/referrals/generate-recruiter-link`.
- Accept `{ recruiterWallet: string, customTag?: string }`.
- Generate link `https://stormsale.io/join?ref=<recruiterWallet>&tag=<customTag>`.

### Target Scope
- `src/controllers/referral.controller.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Returns valid formatted recruitment URL.
- [ ] Validates recruiter wallet format.
- [ ] Sanitizes custom tags to alphanumeric characters."""
    },
    {
        "title": "feat(b2c): batch commission split calculator supporting Stroop decimal precision",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Stellar native asset XLM requires 7 decimal places of precision (1 XLM = 10,000,000 Stroops). Floating point math in JavaScript causes rounding inaccuracies that fail on-chain balance checks.

### Technical Specification
- Use `BigInt` stroop arithmetic for all commission splits.
- Implement `POST /api/referrals/batch-commission-split` processing array of conversions.
- Ensure sum of direct Stroops + override Stroops equals total commission Stroops without rounding loss.

### Target Scope
- `src/services/referral.service.ts`
- `src/controllers/referral.controller.ts`

### Acceptance Criteria
- [ ] Zero rounding drift: `directStroops + overrideStroops === totalStroops`.
- [ ] Handles 1000 items in under 20ms.
- [ ] Unit tests verify fractional XLM amounts (e.g. 0.0000001 XLM)."""
    },
    {
        "title": "feat(b2c): real-time sales volume aggregation for master recruiter dashboards",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "performance"],
        "body": """### Context & Motivation
Master recruiters with hundreds of sub-affiliates need instant dashboard loading without scanning thousands of individual conversion rows.

### Technical Specification
- Maintain materialized aggregate counters on `ReferralRelation`:
  - `salesVolumeXlm`
  - `overrideEarnedXlm`
  - `salesCount`
- Update counters atomically via Prisma increment upon each logged sale.

### Target Scope
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Aggregate counters updated atomically.
- [ ] Recruiter tree query reads cached counter fields directly.
- [ ] Eliminates expensive table scans on conversion tables."""
    },
    {
        "title": "feat(b2c): tier-2 sub-affiliate performance ranking and leaderboard endpoint",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Affiliate community managers want to reward top recruiters and view a leaderboard of the highest-performing sub-affiliates across their networks.

### Technical Specification
- Implement `GET /api/referrals/leaderboard?tier=1|2&timeframe=7d|30d|all`.
- Rank affiliates by total sales volume driven and total overrides generated.
- Return masked wallet addresses for privacy (`G...ABCD`).

### Target Scope
- `src/controllers/referral.controller.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Returns sorted leaderboard array with rank indexes.
- [ ] Privacy masking obscures middle characters of wallet address.
- [ ] Supports timeframe filtering."""
    },
    {
        "title": "feat(b2c): historical override commission payout ledger on ReferralRelation",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "database"],
        "body": """### Context & Motivation
Recruiters need an immutable ledger documenting every passive override payment received from sub-affiliate sales, with transaction hash and timestamp.

### Technical Specification
- Create `OverridePayoutRecord` model in Prisma:
  `{ id, referralRelationId, saleAmountXlm, overrideXlm, onChainTxHash, createdAt }`.
- Insert record whenever an on-chain conversion distributes second-tier commission.
- Expose `GET /api/referrals/payouts/:recruiterAddress`.

### Target Scope
- `prisma/schema.prisma`
- `src/services/referral.service.ts`
- `src/controllers/referral.controller.ts`

### Acceptance Criteria
- [ ] Payout records link to parent referral relationship.
- [ ] Queries support pagination and sorting by date.
- [ ] Records are immutable."""
    },
    {
        "title": "feat(b2c): automated recruiter notification on sub-affiliate conversion milestone",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Gamifying affiliate recruitment increases retention. When a recruited sub-affiliate reaches 10, 50, or 100 sales, the recruiter should receive a notification event.

### Technical Specification
- In `ReferralService.recordSale`, check if `salesCount` reaches milestone thresholds (10, 50, 100, 500, 1000).
- If milestone reached, emit internal event `referral.milestone_reached`.
- Store notification record in database.

### Target Scope
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Milestones triggered exactly once per threshold.
- [ ] Notification payload contains milestone tier and affiliate alias.
- [ ] Unit tests verify milestone boundary conditions."""
    },
    {
        "title": "feat(b2c): sub-affiliate self-service tree view with masked wallet privacy",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "security"],
        "body": """### Context & Motivation
Sub-affiliates want to know who their master recruiter is without exposing full private identity details to unauthorized third parties.

### Technical Specification
- Implement `GET /api/referrals/my-recruiter/:childAddress`.
- Return recruiter wallet with privacy mask (e.g. `GCLX...2222`), established date, and agreed override percentage.

### Target Scope
- `src/controllers/referral.controller.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Returns 200 with recruiter summary if recruited.
- [ ] Returns `{ hasRecruiter: false }` if independent affiliate.
- [ ] Full unmasked address only visible if caller proves wallet signature."""
    },
    {
        "title": "feat(b2c): configurable default override rates per campaign category",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Different campaign categories (DeFi, SaaS, E-commerce) require different standard referral override percentages.

### Technical Specification
- Add `defaultOverrideRate Float @default(2.0)` to `Campaign` model.
- When generating affiliate referral relationships under a campaign, use campaign's default rate if unspecified.

### Target Scope
- `prisma/schema.prisma`
- `src/services/campaign.service.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Newly registered referrals inherit campaign override default.
- [ ] Custom override rate can still override the default if specified."""
    },
    {
        "title": "feat(b2c): recruiter transfer mechanism with mutual affiliate signature agreement",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "security"],
        "body": """### Context & Motivation
In agency buyouts, a recruiter may transfer their recruited sub-affiliates to a new agency. Both the old recruiter and new recruiter must sign cryptographic authorizations.

### Technical Specification
- Implement `POST /api/referrals/transfer/request`.
- Implement `POST /api/referrals/transfer/confirm` verifying signatures of both parties.
- Update `recruiterAddress` on matching `ReferralRelation` records.

### Target Scope
- `src/services/referral.service.ts`
- `src/controllers/referral.controller.ts`

### Acceptance Criteria
- [ ] Requires valid cryptographic signatures from both wallets.
- [ ] Updates all target referral records in single database transaction.
- [ ] Preserves all historical sales volume and payout records."""
    },
    {
        "title": "feat(b2c): referral link expiration and promotional campaign window support",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "database"],
        "body": """### Context & Motivation
Certain recruitment campaigns are time-limited promotions offering elevated override rates for 30 days before reverting to standard rates.

### Technical Specification
- Add `expiresAt DateTime?` and `fallbackOverrideRate Float?` to `ReferralRelation`.
- In commission split calculator, if `now() > expiresAt`, apply `fallbackOverrideRate`.

### Target Scope
- `prisma/schema.prisma`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Promotional rate applies before expiresAt.
- [ ] Fallback rate applies seamlessly after expiration without manual updates.
- [ ] Unit tests cover boundary timestamps."""
    },
    {
        "title": "feat(b2c): custom affiliate referral vanity code reservation and claims",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Creators prefer sharing clean vanity codes like `join/crypto-daily` instead of 56-character Stellar public keys.

### Technical Specification
- Create `VanityCode` model: `{ code @unique, walletAddress, isActive, createdAt }`.
- Implement `POST /api/referrals/vanity` to reserve alphanumeric code (3-20 chars).
- Implement `GET /api/referrals/vanity/:code` resolving code to wallet address.

### Target Scope
- `prisma/schema.prisma`
- `src/services/referral.service.ts`
- `src/controllers/referral.controller.ts`

### Acceptance Criteria
- [ ] Reserved code maps to owning wallet.
- [ ] Duplicate code claims rejected with 409 Conflict.
- [ ] Profanity and reserved word filter rejects inappropriate codes."""
    },
    {
        "title": "feat(b2c): referral tree depth limiter enforcing strict 2-tier maximum",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
StormSale is an affiliate protocol, not a multi-level marketing scheme. A strict depth limit of 2 tiers must be hardcoded and verified at the API level.

### Technical Specification
- In `ReferralService.registerReferral`, check tier of recruiter.
- If recruiter is already a Tier 2 sub-affiliate, reject recruitment attempt with error "Maximum 2-tier referral depth reached".

### Target Scope
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Tier 1 recruiter can recruit Tier 2 sub-affiliate.
- [ ] Tier 2 sub-affiliate is blocked from recruiting Tier 3 sub-affiliate.
- [ ] Rejection returns 400 Bad Request."""
    },
    {
        "title": "feat(b2c): referral conversion reconciliation against Soroban smart contract events",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "database"],
        "body": """### Context & Motivation
Discrepancies between off-chain database counters and on-chain Soroban contract state must be audited automatically to prevent accounting drift.

### Technical Specification
- Implement reconciliation cron worker running every 6 hours.
- Compare on-chain escrow payouts with off-chain `ReferralRelation.overrideEarnedXlm`.
- Flag discrepancies in `AuditReport` table.

### Target Scope
- `src/workers/reconciliation.worker.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Audits all active referral pairs against on-chain transaction logs.
- [ ] Discrepancies > 0.0001 XLM trigger alert.
- [ ] Reports generated with full audit details."""
    },
    {
        "title": "feat(b2c): export referral tree network metrics to CSV and JSON formats",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Affiliate managers need to export their sub-affiliate network metrics for accounting and tax reporting.

### Technical Specification
- Implement `GET /api/referrals/export/:recruiterAddress?format=csv|json`.
- Stream CSV output containing sub-affiliate wallet, recruited date, sales count, sales volume, and override earned.

### Target Scope
- `src/controllers/referral.controller.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Streams valid CSV with correct headers.
- [ ] Handles 10,000 rows without memory spikes.
- [ ] Content-Disposition header triggers file download in browser."""
    },
    {
        "title": "test(b2c): property-based testing for two-tier commission split arithmetic",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "testing"],
        "body": """### Context & Motivation
Commission split math must be proven correct across random edge case numbers (zero amount, huge amounts, prime decimal rates) without any Stroop leakage.

### Technical Specification
- Create `src/tests/referral.arithmetic.test.ts`.
- Run 1,000 property-based random tests varying sale amounts (1 to 10,000,000 XLM) and split percentages.
- Assert invariant `directStroops + overrideStroops === totalStroops` always holds.

### Target Scope
- `src/tests/referral.arithmetic.test.ts`

### Acceptance Criteria
- [ ] 1,000 random iterations complete with 100% pass rate.
- [ ] Zero rounding discrepancies detected.
- [ ] Fast execution (< 500ms total)."""
    },

    # -------------------------------------------------------------------------
    # Pillar 4: B2C Tracked Short Links, Vanity Slugs & Redirection Engine (53 - 68)
    # -------------------------------------------------------------------------
    {
        "title": "feat(b2c): ultra-low latency short link redirect router using Redis caching",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "performance"],
        "body": """### Context & Motivation
Affiliate link clicks occur at high volume. Hitting the database on every redirect introduces latency. Short link resolutions must be cached in Redis with sub-5ms response times.

### Technical Specification
- On `GET /api/links/:slug`, check Redis key `link:slug:<slug>`.
- If cache hit, return target URL immediately and push click event to Redis stream `clicks:stream`.
- If cache miss, fetch from PostgreSQL, write to Redis with 1h TTL, and return.

### Target Scope
- `src/services/shortlink.service.ts`
- `src/controllers/shortlink.controller.ts`

### Acceptance Criteria
- [ ] Cache hit response time under 10ms.
- [ ] Cache invalidation occurs when short link targetUrl is modified.
- [ ] Asynchronous click logging preserves performance."""
    },
    {
        "title": "feat(b2c): reserved word blacklist validation for custom short link slugs",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "security"],
        "body": """### Context & Motivation
Certain slugs (`admin`, `api`, `login`, `health`, `dashboard`, `settings`) must never be claimed as affiliate short links to prevent URL collision with application routes.

### Technical Specification
- Create reserved word list of 100+ standard routing words.
- In `ShortLinkController.createShortLink`, validate slug against reserved list.
- Return 400 Bad Request if reserved slug requested.

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/config/reservedWords.ts`

### Acceptance Criteria
- [ ] Rejects reserved slugs like `api`, `health`, `admin`.
- [ ] Allows valid custom slugs like `stellar-deal-2026`.
- [ ] Case-insensitive comparison."""
    },
    {
        "title": "feat(b2c): dynamic QR code generation endpoint with customizable brand styling",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Affiliates promoting links at live events, podcasts, or offline print media require high-resolution QR codes that resolve directly to their tracked short link.

### Technical Specification
- Implement `GET /api/links/:slug/qr?format=png|svg&size=300`.
- Generate QR code with error correction level H (30% redundancy).
- Return image buffer with proper `Content-Type` header (`image/png` or `image/svg+xml`).

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Returns valid scannable QR code image.
- [ ] Supports PNG and SVG formats.
- [ ] Cache-Control header caches image in browser for 24h."""
    },
    {
        "title": "feat(b2c): subId parameter propagation and UTM campaign attribution parser",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Performance affiliates use `subId`, `utm_source`, `utm_medium`, and `utm_campaign` parameters to measure ROI across ads. These parameters must be preserved across redirects.

### Technical Specification
- Extract query parameters on short link resolution.
- Merge affiliate tracking parameters into destination URL query string.
- Record `subId` in the `Click` telemetry record.

### Target Scope
- `src/services/shortlink.service.ts`
- `src/controllers/shortlink.controller.ts`

### Acceptance Criteria
- [ ] Incoming query params appended cleanly to targetUrl.
- [ ] Existing targetUrl query params preserved without corruption.
- [ ] `subId` persisted in Click database record."""
    },
    {
        "title": "feat(b2c): anonymized client IP hashing using rotating salt for privacy compliance",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "security"],
        "body": """### Context & Motivation
GDPR and privacy regulations prohibit storing raw user IP addresses. The backend must hash IPs with a cryptographically secure, daily rotating server salt.

### Technical Specification
- Compute `ipHash = HMAC_SHA256(daily_salt, client_ip)`.
- Never persist raw IP address in database or log files.
- Same IP on same day hashes to same hash for velocity detection, but cannot be reversed to PII.

### Target Scope
- `src/services/shortlink.service.ts`
- `src/utils/crypto.ts`

### Acceptance Criteria
- [ ] Raw IP is never stored in PostgreSQL.
- [ ] Resulting hash is deterministic for velocity checks within 24h window.
- [ ] Salt rotation prevents long-term cross-site profiling."""
    },
    {
        "title": "feat(b2c): geo-IP country and device type resolution on link click stream",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Advertisers need country-level and device-level (mobile, desktop, tablet) breakdown of where affiliate traffic originates.

### Technical Specification
- Add `countryCode String?` and `deviceType String?` to `Click` model.
- Parse `User-Agent` header to detect device class.
- Resolve IP to 2-letter ISO country code using lightweight GeoIP database or header (e.g. `cf-ipcountry`).

### Target Scope
- `prisma/schema.prisma`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Click records store resolved country code and device category.
- [ ] Missing headers fallback gracefully to `UNKNOWN`.
- [ ] No external blocking HTTP calls on redirect path."""
    },
    {
        "title": "feat(b2c): click event buffering and batch writer to mitigate database write contention",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "performance"],
        "body": """### Context & Motivation
During viral social campaigns, thousands of clicks arrive per second. Individual SQL `INSERT` statements will lock the database. A micro-batching buffer is required.

### Technical Specification
- Buffer click events in memory or Redis list.
- Flush buffer to PostgreSQL using `prisma.click.createMany()` every 2 seconds or when batch reaches 200 items.
- Graceful shutdown flushes remaining buffer before closing.

### Target Scope
- `src/buffers/click.buffer.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Clicks written in batch inserts.
- [ ] Database write operations reduced by >90% during high traffic.
- [ ] No dropped clicks on process SIGTERM/SIGINT."""
    },
    {
        "title": "feat(b2c): bot user-agent filtering and crawler click exclusion",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "security"],
        "body": """### Context & Motivation
Search engine crawlers, social preview scrapers (TwitterBot, FacebookExternalHit), and automated spiders inflate click counts without representing real human traffic.

### Technical Specification
- Inspect `User-Agent` header against crawler regex patterns.
- If bot detected:
  - Perform redirect as normal.
  - Set `isBot: true` on Click record or exclude from billable affiliate analytics.

### Target Scope
- `src/services/shortlink.service.ts`
- `src/utils/botDetector.ts`

### Acceptance Criteria
- [ ] Googlebot, Twitterbot, and curl flagged as bot traffic.
- [ ] Standard Chrome/Safari mobile browsers recorded as human.
- [ ] Bot clicks excluded from billable affiliate metrics."""
    },
    {
        "title": "feat(b2c): custom domain CNAME routing support for enterprise and top affiliates",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "b2c", "infra"],
        "body": """### Context & Motivation
Top creators and enterprise brands want links on their own branded domain (e.g. `go.mybrand.com/deal`) instead of `stormsale.io`.

### Technical Specification
- Create `CustomDomain` model: `{ domain @unique, organizationId?, affiliateWallet?, isVerified, sslStatus }`.
- Inspect `Host` header on incoming requests.
- Resolve custom domain to tenant account and route accordingly.

### Target Scope
- `prisma/schema.prisma`
- `src/services/domain.service.ts`
- `src/app.ts`

### Acceptance Criteria
- [ ] Resolves short links accessed via verified custom domain.
- [ ] Unverified domains return 404.
- [ ] Domain verification endpoint checks TXT DNS record."""
    },
    {
        "title": "feat(b2c): short link expiration timestamp and redirect fallback URL",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Flash deals and limited-time discounts expire. Expired links should redirect users to a fallback deal or campaign homepage instead of a broken page.

### Technical Specification
- Add `expiresAt DateTime?` and `fallbackUrl String?` to `ShortLink` model.
- If `now() > expiresAt`, redirect to `fallbackUrl` (or campaign homepage if fallback is null).

### Target Scope
- `prisma/schema.prisma`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Active links redirect to targetUrl.
- [ ] Expired links redirect to fallbackUrl.
- [ ] Click logged with `isExpiredRedirect: true`."""
    },
    {
        "title": "feat(b2c): link click telemetry timeseries endpoint (hourly, daily, monthly)",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "database"],
        "body": """### Context & Motivation
Affiliate dashboards render interactive timeseries charts of clicks over time. The backend must provide grouped timeseries aggregation endpoints.

### Technical Specification
- Implement `GET /api/links/:slug/analytics?interval=hour|day|month&from=...&to=...`.
- Use `date_trunc` SQL grouping to aggregate click counts by timeframe.
- Fill zero-count intervals to provide continuous chart data.

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Returns array of `{ timestamp, clicksCount, uniqueIps }`.
- [ ] Intervals with zero clicks included with count 0.
- [ ] Query response time < 50ms."""
    },
    {
        "title": "feat(b2c): short link editing for target destination URL with history audit",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
When an advertiser updates their product landing page, affiliates must be able to update their link's destination URL without breaking previously shared short links.

### Technical Specification
- Implement `PATCH /api/links/:slug`.
- Verify caller owns `affiliateWallet` via signature or auth token.
- Update `targetUrl` and record previous URL in `LinkEditHistory`.

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Only the link owner can update targetUrl.
- [ ] Update immediately alters redirect behavior.
- [ ] History record captures previous URL and timestamp."""
    },
    {
        "title": "feat(b2c): short link preview metadata scraping for rich social graph embeds",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
When short links are shared on Telegram, Twitter, or Discord, rich preview cards (og:title, og:image, og:description) should render the target campaign's branding.

### Technical Specification
- Implement HTML preview generator for social crawler user agents.
- Return minimal HTML page with OpenGraph `<meta>` tags before redirecting human users via JavaScript or HTTP meta-refresh.

### Target Scope
- `src/controllers/shortlink.controller.ts`

### Acceptance Criteria
- [ ] Social crawler receives 200 OK with correct OpenGraph meta tags.
- [ ] Human browser receives immediate 302 redirect to target destination.
- [ ] Campaign title and logo populated in og:title and og:image."""
    },
    {
        "title": "feat(b2c): bulk short link generation API for multi-channel affiliate campaigns",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Professional affiliates running ads across Google, Facebook, TikTok, and Twitter need to generate separate tagged links for each channel simultaneously.

### Technical Specification
- Implement `POST /api/links/bulk`.
- Accept `{ campaignId, affiliateWallet, channels: ['twitter', 'youtube', 'newsletter', 'telegram'] }`.
- Generate distinct slugs for each channel with respective subId tracking tags.

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Generates multiple distinct short links in a single request.
- [ ] Each link tagged with appropriate channel subId.
- [ ] Returns array of created link objects."""
    },
    {
        "title": "feat(b2c): affiliate short link archiving and click counter reset endpoints",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2c", "api"],
        "body": """### Context & Motivation
Affiliates running new seasonal campaigns want to archive old links or reset testing click counts before official campaign launch.

### Technical Specification
- Implement `POST /api/links/:slug/archive`.
- Implement `POST /api/links/:slug/reset-stats` (only allowed if zero sales recorded).

### Target Scope
- `src/controllers/shortlink.controller.ts`
- `src/services/shortlink.service.ts`

### Acceptance Criteria
- [ ] Archived link returns 410 Gone or fallback URL.
- [ ] Reset stats resets click counter to zero if no sales recorded.
- [ ] Action restricted to link owner."""
    },
    {
        "title": "test(b2c): high-concurrency benchmark test suite for short link redirect engine",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "b2c", "testing"],
        "body": """### Context & Motivation
The short link redirect router is on the critical performance path. It must maintain high throughput (>1,000 req/sec) without memory leaks.

### Technical Specification
- Create `src/tests/shortlink.benchmark.test.ts`.
- Simulate 500 concurrent requests against short link endpoint.
- Assert 100% success rate with p99 latency < 50ms.

### Target Scope
- `src/tests/shortlink.benchmark.test.ts`

### Acceptance Criteria
- [ ] Benchmark test executes and passes cleanly.
- [ ] Validates zero dropped clicks under concurrency.
- [ ] Resource usage stays within nominal limits."""
    },

    # -------------------------------------------------------------------------
    # Pillar 5: Fraud Anomaly Detection & Velocity Telemetry Engine (69 - 82)
    # -------------------------------------------------------------------------
    {
        "title": "feat(fraud): rolling window click-to-conversion velocity tracker per affiliate",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security", "performance"],
        "body": """### Context & Motivation
Fraudulent bot scripts submit conversion bursts within seconds. A sliding-window velocity tracker in Redis is needed to count conversions per minute in real time.

### Technical Specification
- Use Redis sorted sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) key: `velocity:<affiliate>:<campaignId>`.
- Count conversions recorded within the last 60 seconds.
- Pass current velocity into `FraudService.evaluateRisk`.

### Target Scope
- `src/services/fraud.service.ts`
- `src/services/redis.service.ts`

### Acceptance Criteria
- [ ] Real-time velocity calculated with 1-second accuracy.
- [ ] Old entries pruned automatically outside 60-second window.
- [ ] Memory footprint bounded per affiliate."""
    },
    {
        "title": "feat(fraud): Z-score anomaly scoring with dynamic campaign baseline calculation",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "security", "database"],
        "body": """### Context & Motivation
A fixed velocity threshold causes false positives during legitimate viral sales spikes. Dynamic Z-score analysis compares affiliate velocity against the campaign's standard deviation.

### Technical Specification
- Calculate hourly campaign mean velocity (`mu`) and standard deviation (`sigma`).
- Compute `Z = (affiliate_velocity - mu) / sigma`.
- Flag anomaly when `Z >= 3.0` (more than 3 standard deviations above normal).

### Target Scope
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Computes Z-score accurately.
- [ ] Fallback applied when campaign has insufficient sample size (< 10 conversions).
- [ ] Z >= 3.0 triggers HIGH risk score."""
    },
    {
        "title": "feat(fraud): instant conversion detector flagging sub-2-second bot executions",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "security", "api"],
        "body": """### Context & Motivation
Human users take at least several seconds to browse a landing page, add items to cart, and checkout. Conversions completed in under 2 seconds are guaranteed bot fraud.

### Technical Specification
- In `FraudService.evaluateRisk`, compute `timeDelta = conversionTime - clickTime`.
- If `timeDelta < 2.0` seconds:
  - Set `isInstantAnomaly = true`.
  - Set `riskLevel = 'HIGH'`.
  - Flag reason `Instant click-to-conversion delta (< 2.0s)`.

### Target Scope
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Sub-2-second conversions flagged as anomalies.
- [ ] Realistic human deltas (30s, 2m) pass with LOW risk.
- [ ] Reason string recorded in FraudRecord."""
    },
    {
        "title": "feat(fraud): IP hash concentration index using Gini coefficient / entropy scoring",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "security", "database"],
        "body": """### Context & Motivation
If 80% of an affiliate's conversions come from the same hashed IP, the affiliate is likely self-purchasing or cycling a local proxy.

### Technical Specification
- In `FraudService`, calculate IP concentration percentage:
  `concentration = (conversions_from_top_ip / total_conversions) * 100`.
- If `concentration > 50%` and `total_conversions > 5`, elevate risk score to HIGH or CRITICAL.

### Target Scope
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Detects IP concentration anomalies accurately.
- [ ] Ignores low sample sizes (<= 3 conversions) to avoid false positives.
- [ ] Persists topIpConcentration metric in risk profile."""
    },
    {
        "title": "feat(fraud): automated affiliate pause policy on consecutive CRITICAL risk evaluations",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security", "api"],
        "body": """### Context & Motivation
When an affiliate generates multiple CRITICAL risk scores, automated policy should pause them to protect advertiser escrow funds until manual review.

### Technical Specification
- In `FraudService.evaluateRisk`, count CRITICAL evaluations for affiliate in past 24 hours.
- If count >= 2, set `isPaused = true` across all affiliate campaign participations.
- Emit webhook event `affiliate.fraud_paused`.

### Target Scope
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Automatically pauses affiliate upon second CRITICAL evaluation.
- [ ] Paused affiliate links redirect to pause notice or campaign fallback.
- [ ] Emits security alert event."""
    },
    {
        "title": "feat(fraud): advertiser fraud dispute and manual affiliate unpause override endpoint",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
In cases of false positives (e.g. flash mob during live stream), the advertiser or organization admin must be able to unpause the affiliate with audit notes.

### Technical Specification
- Implement `POST /api/fraud/affiliate/:affiliateAddress/override`.
- Accept `{ isPaused: boolean, notes: string, orgId: string }`.
- Verify caller is advertiser or organization admin for the associated campaigns.

### Target Scope
- `src/controllers/fraud.controller.ts`
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Only authorized advertiser/admin can unpause.
- [ ] Reason and reviewer wallet address logged in audit record.
- [ ] Unpause immediately restores link functionality."""
    },
    {
        "title": "feat(fraud): repetitive subId pattern recognition across disparate IP addresses",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security", "api"],
        "body": """### Context & Motivation
Sophisticated bot farms rotate IP addresses through proxies, but often reuse the same automated tracking subId parameter across all requests.

### Technical Specification
- Track `subId` distribution across distinct IP hashes for each affiliate.
- If single subId accounts for >90% of conversions across >20 distinct IP hashes in under 1 hour, flag as `REPETITIVE_SUB_ID_BURST`.

### Target Scope
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Identifies repetitive subId fraud patterns.
- [ ] Flags risk factor code `REPETITIVE_SUB_ID`.
- [ ] Logs anomaly details in fraud audit table."""
    },
    {
        "title": "feat(fraud): ASN and datacenter proxy IP range detection integration",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security", "infra"],
        "body": """### Context & Motivation
Conversions originating from cloud server hosting ASNs (AWS, DigitalOcean, Hetzner, OVH) rather than residential ISPs are almost universally bot traffic.

### Technical Specification
- Integrate lightweight ASN lookup check against known datacenter IP ranges.
- Flag conversions from hosting providers with `isDatacenterProxy: true`.
- Escalate risk score by +1.5 standard deviations.

### Target Scope
- `src/services/fraud.service.ts`
- `src/utils/asnLookup.ts`

### Acceptance Criteria
- [ ] Known datacenter ranges flagged accurately.
- [ ] Residential connections (Comcast, Verizon, Vodafone) identified as clean.
- [ ] Offline local IP list used to prevent external API latency."""
    },
    {
        "title": "feat(fraud): fraud telemetry webhook alert dispatch for advertisers",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "b2b", "api"],
        "body": """### Context & Motivation
Advertisers need immediate alerts when fraud is detected on their campaigns so they can inspect conversion details before the clearing period expires.

### Technical Specification
- On any HIGH or CRITICAL fraud evaluation, queue webhook event `fraud.anomaly_detected`.
- Include payload: `{ campaignId, affiliateAddress, riskLevel, zScore, reasons, timeDeltaSeconds }`.

### Target Scope
- `src/services/fraud.service.ts`
- `src/services/webhook.service.ts`

### Acceptance Criteria
- [ ] Dispatches webhook to registered organization endpoints.
- [ ] LOW and MEDIUM risk scores do not trigger alert spam.
- [ ] Webhook payload adheres to standard schema."""
    },
    {
        "title": "feat(fraud): historical fraud risk audit logs and incident reporting API",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "database", "api"],
        "body": """### Context & Motivation
Auditors and compliance officers need an endpoint to review all historical fraud incidents across a specific date range or campaign.

### Technical Specification
- Implement `GET /api/fraud/incidents?campaignId=...&minRisk=HIGH&limit=50`.
- Return paginated list of fraud records with anomaly details and timestamps.

### Target Scope
- `src/controllers/fraud.controller.ts`
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Returns filtered incident reports.
- [ ] Supports filtering by minimum risk level (`MEDIUM`, `HIGH`, `CRITICAL`).
- [ ] Pagination handles large incident sets."""
    },
    {
        "title": "feat(fraud): batch fraud anomaly reprocessing job for retrospective scrutiny",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "database", "infra"],
        "body": """### Context & Motivation
When a new bot network pattern is discovered, the backend should be able to re-evaluate historical conversions from the past 7 days against the updated ruleset.

### Technical Specification
- Create CLI script / worker job `npm run fraud:reprocess -- --days=7`.
- Re-run anomaly detection algorithms across historical click/conversion pairs.
- Output report of newly flagged affiliates.

### Target Scope
- `src/workers/fraudReprocess.worker.ts`
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Reprocesses conversions without duplicating database rows.
- [ ] Generates comparative summary report.
- [ ] Safely runs without degrading live API response latency."""
    },
    {
        "title": "feat(fraud): conversion velocity cooldown throttling per IP subnet",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security", "performance"],
        "body": """### Context & Motivation
To stop brute-force conversion spam from subnet IP ranges (/24), a cooldown throttle should reject conversions occurring faster than 1 per 10 seconds per subnet.

### Technical Specification
- Hash /24 subnet of client IP.
- Enforce 10-second cooldown in Redis key `throttle:subnet:<hash>`.
- Requests within cooldown rejected with HTTP 429 Too Many Requests.

### Target Scope
- `src/middlewares/throttle.middleware.ts`

### Acceptance Criteria
- [ ] Throttles rapid bursts from same /24 subnet.
- [ ] Unrelated subnets unaffected.
- [ ] Redis key automatically expires after cooldown duration."""
    },
    {
        "title": "feat(fraud): machine learning anomaly score ingest pipeline from external models",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "infra", "api"],
        "body": """### Context & Motivation
External ML fraud models (RandomForest, Isolation Forest) scoring batch conversion datasets need an API to push computed fraud probabilities into the backend.

### Technical Specification
- Implement `POST /api/fraud/batch-scores`.
- Authenticate via internal service token.
- Accept array of `{ affiliateAddress, campaignId, mlAnomalyScore: float(0.0 - 1.0), modelVersion }`.
- Update `FraudRecord` with ML score.

### Target Scope
- `src/controllers/fraud.controller.ts`
- `src/services/fraud.service.ts`

### Acceptance Criteria
- [ ] Ingests ML anomaly scores in batches up to 500 items.
- [ ] Scores > 0.85 automatically elevate risk level.
- [ ] Model version tracked for auditability."""
    },
    {
        "title": "test(fraud): synthetic attack simulation test suite (bot bursts, instant clicks)",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "testing", "security"],
        "body": """### Context & Motivation
Automated tests must simulate realistic attack vectors (bot click bursts, instant conversions, high IP concentration) to ensure detectors trigger accurately.

### Technical Specification
- Create `src/tests/fraud.simulation.test.ts`.
- Simulate 4 scenarios:
  1. Human baseline (normal delta, low velocity) -> LOW risk.
  2. Instant bot (0.4s delta) -> HIGH risk instant anomaly.
  3. Velocity burst (Z-score 4.2) -> CRITICAL risk.
  4. Proxy concentration (90% same IP) -> HIGH risk.

### Target Scope
- `src/tests/fraud.simulation.test.ts`

### Acceptance Criteria
- [ ] All 4 attack scenarios assert expected risk level.
- [ ] False positive rate on human baseline is 0%.
- [ ] Runs deterministically without network dependencies."""
    },

    # -------------------------------------------------------------------------
    # Pillar 6: Soroban Smart Contract Event Listener & Ingestion (83 - 94)
    # -------------------------------------------------------------------------
    {
        "title": "feat(soroban): Horizon / RPC WebSocket event streaming subscriber for contract events",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "infra"],
        "body": """### Context & Motivation
The backend must synchronize state with `Storm-Contract` on Stellar. A persistent subscriber listening to Soroban RPC `getEvents` is required.

### Technical Specification
- Implement `SorobanEventListener` service using Stellar RPC client.
- Subscribe to contract events matching `contractId`.
- Stream events to internal event bus for processing.

### Target Scope
- `src/services/soroban.service.ts`
- `src/workers/sorobanEvent.worker.ts`

### Acceptance Criteria
- [ ] Connects to Soroban RPC and streams events.
- [ ] Auto-reconnects with exponential backoff on disconnect.
- [ ] Handles network blips without crashing process."""
    },
    {
        "title": "feat(soroban): parser for campaign_created, campaign_funded, and operator_updated events",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "api"],
        "body": """### Context & Motivation
When campaigns are created or funded on Stellar, Soroban emits structured events. The backend must parse these events and synchronize the `Campaign` model.

### Technical Specification
- Parse event topics `['campaign_created']`, `['campaign_funded']`, `['operator_updated']`.
- Decode ScVal values (u32 onChainId, address advertiser, i128 budget, symbol audience).
- Upsert corresponding database record.

### Target Scope
- `src/parsers/sorobanEvent.parser.ts`
- `src/services/campaign.service.ts`

### Acceptance Criteria
- [ ] Successfully decodes Soroban ScVal contract data types.
- [ ] Updates campaign budget and status upon funding event.
- [ ] Logs parsed event in database."""
    },
    {
        "title": "feat(soroban): parser for conversion_logged and commission_paid contract events",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "api"],
        "body": """### Context & Motivation
When sales are logged on-chain, `conversion_logged` events are emitted. The backend must ingest these to credit affiliate earnings and record sales volume.

### Technical Specification
- Parse event topic `['conversion_logged']`.
- Decode: `{ onChainId, affiliateAddress, saleAmount, directCommission, overrideCommission }`.
- Update `ReferralRelation` and `Campaign` stats.

### Target Scope
- `src/parsers/sorobanEvent.parser.ts`
- `src/services/referral.service.ts`

### Acceptance Criteria
- [ ] Decodes commission amounts from Stroops (i128) to XLM.
- [ ] Updates affiliate sales counters.
- [ ] Fires webhook notifications to advertiser."""
    },
    {
        "title": "feat(soroban): parser for escrow_refunded and campaign_ttl_extended contract events",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "api"],
        "body": """### Context & Motivation
Advertisers can call `refund_escrow` to recover remaining funds, or `extend_ttl` to keep contract storage alive. The backend must track these lifecycle events.

### Technical Specification
- Parse event topics `['escrow_refunded']` and `['ttl_extended']`.
- If escrow refunded, update campaign status to `COMPLETED` or `REFUNDED` and set remaining budget to 0.
- If TTL extended, update `onChainTtlExpiresAt` timestamp.

### Target Scope
- `src/parsers/sorobanEvent.parser.ts`
- `src/services/campaign.service.ts`

### Acceptance Criteria
- [ ] Accurately updates campaign budget on refund.
- [ ] Sets campaign lifecycle status correctly.
- [ ] Prevents new click redirects to refunded campaigns."""
    },
    {
        "title": "feat(soroban): ledger sequence checkpointing to resume event streaming on restart",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "database"],
        "body": """### Context & Motivation
If the backend restarts or crashes, the event listener must resume scanning from the exact ledger sequence where it left off, without missing or duplicating events.

### Technical Specification
- Create `LedgerCheckpoint` model in Prisma: `{ streamKey @unique, lastLedgerSequence, updatedAt }`.
- Update checkpoint atomically inside transaction for every processed ledger block.
- On startup, read checkpoint sequence to start RPC polling.

### Target Scope
- `prisma/schema.prisma`
- `src/services/soroban.service.ts`

### Acceptance Criteria
- [ ] Checkpoint advances monotonically with each processed ledger.
- [ ] Server restart resumes seamlessly from stored sequence.
- [ ] Handles zero-checkpoint startup by querying latest ledger."""
    },
    {
        "title": "feat(soroban): transaction hash deduplication to guarantee idempotent event processing",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "database"],
        "body": """### Context & Motivation
RPC node reorgs or replay requests can deliver the same contract event multiple times. Duplicate events must be discarded before mutating balances.

### Technical Specification
- Create `ProcessedContractEvent` model: `{ txHash @unique, eventIndex, onChainId, eventType, createdAt }`.
- Check if `(txHash, eventIndex)` already exists before executing business logic.
- If already processed, skip processing and log debug message.

### Target Scope
- `prisma/schema.prisma`
- `src/services/soroban.service.ts`

### Acceptance Criteria
- [ ] Duplicate event delivery causes zero duplicate database side-effects.
- [ ] Unique constraint rejects duplicate inserts.
- [ ] Fast lookup on indexed txHash."""
    },
    {
        "title": "feat(soroban): on-chain budget reconciliation worker detecting off-chain discrepancies",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "performance"],
        "body": """### Context & Motivation
Network partitions or RPC outages could cause off-chain database budget numbers to drift from actual Soroban contract escrow balances.

### Technical Specification
- Implement reconciliation worker running every 12 hours.
- Call `get_campaign` on Soroban contract for every active campaign.
- Compare contract remaining budget with database `budget`.
- Alert if delta exceeds 0.001 XLM.

### Target Scope
- `src/workers/sorobanReconciliation.worker.ts`

### Acceptance Criteria
- [ ] Reads on-chain contract state for all active campaigns.
- [ ] Correctly flags any balance divergence.
- [ ] Generates reconciliation log report."""
    },
    {
        "title": "feat(soroban): automated contract TTL monitoring and low-TTL alert dispatcher",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "infra"],
        "body": """### Context & Motivation
Soroban smart contract instances and ledger entries will be archived if their Time-To-Live (TTL) ledger count expires. A monitoring service must alert advertisers before archival.

### Technical Specification
- Query contract instance TTL via Soroban RPC `getLedgerEntries`.
- If remaining TTL < 100,000 ledgers (~5 days):
  - Flag campaign in dashboard with warning `EXPIRING_SOON`.
  - Dispatch email / webhook alert to advertiser to call `extend_ttl`.

### Target Scope
- `src/workers/ttlMonitor.worker.ts`

### Acceptance Criteria
- [ ] Monitors contract TTL ledgers accurately.
- [ ] Alerts triggered when TTL drops below threshold.
- [ ] Alert clears when TTL is extended on-chain."""
    },
    {
        "title": "feat(soroban): fallback polling mechanism when RPC WebSocket stream drops",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "infra"],
        "body": """### Context & Motivation
Public Stellar RPC WebSocket connections may disconnect or become unresponsive. A fallback HTTP polling mechanism ensures continuous event ingestion.

### Technical Specification
- Implement heartbeat on WebSocket stream.
- If no messages received in 60s, switch to HTTP polling (`getEvents` every 5s).
- Attempt WebSocket reconnection in background; switch back when healthy.

### Target Scope
- `src/services/soroban.service.ts`

### Acceptance Criteria
- [ ] Automatically fails over to HTTP polling when socket drops.
- [ ] Resumes WebSocket when connection re-established.
- [ ] Zero missed events during transition."""
    },
    {
        "title": "feat(soroban): event replay CLI command for historical contract re-indexing",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "infra"],
        "body": """### Context & Motivation
During development or recovery after database corruption, engineers need a CLI command to re-index all historical contract events from a given ledger.

### Technical Specification
- Create CLI command `npm run soroban:replay -- --from-ledger=1234567`.
- Query historical events from Soroban RPC in batches of 100 ledgers.
- Ingest into database idempotently.

### Target Scope
- `scripts/replayContractEvents.ts`

### Acceptance Criteria
- [ ] Replays events from specified starting ledger to current tip.
- [ ] Respects existing idempotency guards.
- [ ] Displays live progress bar and event count."""
    },
    {
        "title": "feat(soroban): multi-network RPC configuration (Testnet, Futurenet, Mainnet)",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "infra"],
        "body": """### Context & Motivation
The backend must seamlessly support deployment against Stellar Testnet, Futurenet, or Mainnet through standard environment variables.

### Technical Specification
- Configure `STELLAR_NETWORK = 'TESTNET' | 'FUTURENET' | 'MAINNET'`.
- Set corresponding Horizon URL, RPC URL, and Network Passphrase.
- Validate contract ID format for target network.

### Target Scope
- `src/config/stellar.ts`

### Acceptance Criteria
- [ ] Correct network passphrase applied based on env var.
- [ ] Network mismatch error thrown if contract ID belongs to different network.
- [ ] Documented in README and .env.example."""
    },
    {
        "title": "test(soroban): mocked RPC event stream ingestion test suite",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "testing"],
        "body": """### Context & Motivation
Integration test suites must verify contract event ingestion without requiring a live connection to external Stellar testnet RPC nodes.

### Technical Specification
- Create `src/tests/soroban.ingestion.test.ts`.
- Mock Soroban RPC client returning simulated event arrays for `campaign_created`, `conversion_logged`, and `refund_escrow`.
- Verify database state updates correctly for each event.

### Target Scope
- `src/tests/soroban.ingestion.test.ts`

### Acceptance Criteria
- [ ] Tests verify all 5 contract event types.
- [ ] Runs deterministically in under 200ms.
- [ ] Ingestion failures test error handling and retry logic."""
    },

    # -------------------------------------------------------------------------
    # Pillar 7: Production Infrastructure, Rate Limiting, Security & Observability (95 - 105)
    # -------------------------------------------------------------------------
    {
        "title": "feat(infra): Docker multi-stage production container build with non-root user",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "infra"],
        "body": """### Context & Motivation
Production deployment requires a hardened, minimal Docker image containing only compiled JavaScript assets, running as an unprivileged non-root user.

### Technical Specification
- Update `Dockerfile` to multi-stage build:
  1. `builder` stage: install devDependencies, build TypeScript (`tsc`), generate Prisma client.
  2. `runner` stage: `node:22-alpine`, install only production dependencies, copy `dist/` and `prisma/`.
  3. Set `USER node`.

### Target Scope
- `Dockerfile`
- `.dockerignore`

### Acceptance Criteria
- [ ] Docker image size reduced under 150MB.
- [ ] Container runs as non-root user `node`.
- [ ] Container passes security vulnerability scans."""
    },
    {
        "title": "feat(infra): Docker Compose stack with PostgreSQL, Redis, and health checks",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "infra"],
        "body": """### Context & Motivation
Local development and staging deployments require a reproducible one-command environment orchestrating the backend API, PostgreSQL, and Redis.

### Technical Specification
- Create `docker-compose.yml` defining services:
  - `api`: Node backend with restart on failure.
  - `db`: `postgres:16-alpine` with health check `pg_isready`.
  - `redis`: `redis:7-alpine` with health check `redis-cli ping`.
- Configure persistent volume mounts for data persistence.

### Target Scope
- `docker-compose.yml`

### Acceptance Criteria
- [ ] `docker compose up` starts entire stack successfully.
- [ ] API service waits for database health check before starting.
- [ ] Data persists across container restarts."""
    },
    {
        "title": "feat(infra): Prometheus metrics endpoint (/metrics) for request latency and counts",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "performance"],
        "body": """### Context & Motivation
Production operations teams need standard Prometheus metrics to monitor API request rates, latency percentiles (p50, p95, p99), and error counts.

### Technical Specification
- Install `prom-client`.
- Expose `GET /metrics` protected by internal network or bearer token.
- Record `http_requests_total`, `http_request_duration_seconds` histogram, and Prisma active connections gauge.

### Target Scope
- `src/middlewares/metrics.middleware.ts`
- `src/app.ts`

### Acceptance Criteria
- [ ] `/metrics` outputs standard Prometheus text format.
- [ ] Histograms record accurate latency buckets.
- [ ] Negligible overhead (< 1ms per request)."""
    },
    {
        "title": "feat(infra): structured JSON logger using Winston or Pino with correlation IDs",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "infra"],
        "body": """### Context & Motivation
Cloud log aggregators (Datadog, CloudWatch, GCP Cloud Logging) require structured JSON logs containing timestamp, log level, message, and distributed tracing correlation ID.

### Technical Specification
- Replace `console.log` statements with Pino or Winston structured logger.
- Add middleware injecting unique `x-request-id` into request context.
- Output JSON format in production; human-readable format in development.

### Target Scope
- `src/utils/logger.ts`
- `src/middlewares/requestId.middleware.ts`

### Acceptance Criteria
- [ ] All logs emit valid JSON objects with `requestId`.
- [ ] Error logs include parsed stack traces without raw customer PII.
- [ ] Configurable log levels (`debug`, `info`, `warn`, `error`)."""
    },
    {
        "title": "feat(security): IP-based and wallet-based token bucket rate limiter middleware",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "security"],
        "body": """### Context & Motivation
To protect API endpoints against denial-of-service and credential stuffing attacks, rate limiting must be enforced per IP address and authenticated wallet.

### Technical Specification
- Implement token bucket rate limiter backed by Redis.
- Configure rate limits:
  - Public endpoints: 100 requests per minute per IP.
  - Short link redirect: 300 requests per minute per IP.
  - Authenticated user endpoints: 500 requests per minute per wallet.
- Return standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

### Target Scope
- `src/middlewares/rateLimiter.middleware.ts`

### Acceptance Criteria
- [ ] Rate limit headers returned on all responses.
- [ ] Exceeding limit returns 429 Too Many Requests with Retry-After header.
- [ ] Redis downtime degrades gracefully to in-memory fallback."""
    },
    {
        "title": "feat(security): Helmet security headers and strict CORS configuration",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "security"],
        "body": """### Context & Motivation
Modern web security best practices require enforcing standard HTTP security headers (Content Security Policy, X-Frame-Options, HSTS) to protect client browsers.

### Technical Specification
- Integrate `helmet` middleware.
- Configure strict CORS options allowing only approved frontend origins (`stormsale.io`, `*.stormsale.io`, `localhost:3000`).
- Disable `X-Powered-By: Express` header.

### Target Scope
- `src/app.ts`

### Acceptance Criteria
- [ ] Helmet headers present on all HTTP responses.
- [ ] Cross-origin requests from unapproved domains rejected.
- [ ] Express signature header removed."""
    },
    {
        "title": "feat(security): centralized error handling middleware sanitizing database stack traces",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "security"],
        "body": """### Context & Motivation
Leaking raw PostgreSQL query errors or Prisma schema details to clients during 500 Internal Server Errors poses a security reconnaissance vulnerability.

### Technical Specification
- Implement centralized Express error handler `errorHandler(err, req, res, next)`.
- Log full error stack internally with requestId.
- Return sanitized user-facing JSON: `{ error: 'Internal Server Error', requestId: '...' }` without database internals.

### Target Scope
- `src/middlewares/errorHandler.middleware.ts`
- `src/app.ts`

### Acceptance Criteria
- [ ] Database connection errors or query syntax errors are masked.
- [ ] Unique error requestId returned to client for support referencing.
- [ ] Zod validation errors (400) continue returning detailed parameter issues."""
    },
    {
        "title": "feat(security): input payload byte size limiter and DDoS request flood shield",
        "labels": ["Drips", "complexity", "complexity: low", "backend", "security"],
        "body": """### Context & Motivation
Attackers can exhaust server memory by sending massive JSON payloads (100MB+) in POST requests. A strict body parser limit must be configured.

### Technical Specification
- In `src/app.ts`, configure `express.json({ limit: '100kb' })`.
- Return HTTP 413 Payload Too Large if request body exceeds limit.

### Target Scope
- `src/app.ts`

### Acceptance Criteria
- [ ] Payloads <= 100KB parsed normally.
- [ ] Payloads > 100KB immediately rejected with 413 Payload Too Large.
- [ ] Server memory protected from large payload buffering."""
    },
    {
        "title": "feat(infra): OpenTelemetry distributed tracing integration for API calls",
        "labels": ["Drips", "complexity", "complexity: high", "backend", "infra"],
        "body": """### Context & Motivation
Diagnosing latency across microservices, database queries, and external Stellar RPC calls requires distributed tracing spans with OpenTelemetry.

### Technical Specification
- Instrument Express, HTTP, and Prisma with `@opentelemetry/sdk-node`.
- Export trace spans via OTLP / Jaeger exporter.
- Propagate `traceparent` headers across outgoing webhook and RPC requests.

### Target Scope
- `src/tracing.ts`
- `src/index.ts`

### Acceptance Criteria
- [ ] Traces capture HTTP route, Prisma SQL query execution time, and status.
- [ ] Negligible overhead in production.
- [ ] Configurable sampling rate (default 10% in prod, 100% in dev)."""
    },
    {
        "title": "feat(infra): automated database migration and Prisma schema drift check in CI",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "infra"],
        "body": """### Context & Motivation
To prevent production deployment failures caused by schema mismatch, GitHub Actions CI must verify that Prisma migrations apply cleanly and detect schema drift.

### Technical Specification
- Add CI workflow step running `prisma migrate diff` comparing schema with migrations folder.
- Run `prisma migrate deploy` against ephemeral PostgreSQL service container.

### Target Scope
- `.github/workflows/ci.yml`

### Acceptance Criteria
- [ ] CI fails if schema.prisma has uncommitted migration changes.
- [ ] Validates that all migrations apply cleanly in clean database.
- [ ] Runs on all Pull Requests targeting `main`."""
    },
    {
        "title": "test(infra): end-to-end smoke test script validating live container deployment",
        "labels": ["Drips", "complexity", "complexity: medium", "backend", "testing"],
        "body": """### Context & Motivation
Following container deployment, a smoke test script must run against the live instance to verify health endpoints, database connectivity, and API responsiveness before switching traffic.

### Technical Specification
- Create `scripts/smoke_test.sh`.
- Execute sequence:
  1. GET `/health` (expect 200 OK).
  2. POST `/api/users` with test wallet (expect 200).
  3. GET `/api/campaigns` (expect 200 array).
- Exit code 0 if all pass; non-zero if any step fails.

### Target Scope
- `scripts/smoke_test.sh`

### Acceptance Criteria
- [ ] Validates entire operational path in under 5 seconds.
- [ ] Returns exit code 1 with diagnostic output on failure.
- [ ] Usable in CI/CD deployment pipelines."""
    }
]

def main():
    print(f"Total issues to create: {len(ISSUES)}")
    created = 0
    failed = 0

    for idx, issue in enumerate(ISSUES, 1):
        title = issue["title"]
        labels = issue["labels"]
        body = issue["body"]

        cmd = [
            "gh", "issue", "create",
            "--repo", "StormSale/StormSale-backend",
            "--title", title,
            "--body", body
        ]
        for label in labels:
            cmd.extend(["--label", label])

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            url = res.stdout.strip()
            print(f"[{idx}/{len(ISSUES)}] Created #{idx}: {title} -> {url}")
            created += 1
            # Brief delay to avoid hitting secondary GitHub API rate limits
            time.sleep(0.35)
        except subprocess.CalledProcessError as e:
            print(f"[{idx}/{len(ISSUES)}] FAILED: {title}")
            print(f"  Error: {e.stderr.strip()}")
            failed += 1

    print(f"\nFinished! Created: {created}, Failed: {failed}")

if __name__ == "__main__":
    main()

