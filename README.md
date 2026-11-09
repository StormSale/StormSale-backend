<div align="center">
  <h1>⚡ StormSale API Backend</h1>
  <p><strong>High-Performance Node.js, TypeScript & PostgreSQL Microservice for the StormSale Decentralized Affiliate Protocol on Stellar</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-blue?logo=docker)](docker-compose.yml)
[![Tests](https://img.shields.io/badge/Tests-26%2F26%20Passing-brightgreen)](src/tests/)
</div>

<br />

## 📖 Overview

The **StormSale Backend** is a cloud-native indexing and business logic microservice for the [StormSale Decentralized Affiliate Protocol](https://stormsale.io) on the Stellar Network (Soroban).

It powers both **B2B Enterprise Organizations** (multi-seat RBAC, team delegation, campaign operator authorization, webhooks) and **B2C Consumer Networks** (two-tier affiliate trees, Stroop-precision commission calculations, fraud anomaly detection, and tracked short links).

---

## 🏗️ Architecture & Modules

```text
src/
├── config/         # Prisma client singleton, in-memory mock engine, and environment configs
├── controllers/    # Express route handlers with Zod schema validation
│   ├── campaign.controller.ts     # B2B & B2C campaign creation, filtering, and retrieval
│   ├── fraud.controller.ts        # Real-time velocity telemetry & anomaly scoring
│   ├── organization.controller.ts # Enterprise multi-seat RBAC & team membership
│   ├── referral.controller.ts     # Two-tier affiliate trees & commission splits
│   ├── shortlink.controller.ts    # Tracked short link resolution & redirect engine
│   ├── user.controller.ts         # Stellar ed25519 wallet registration & profiles
│   └── webhook.controller.ts      # HMAC-SHA256 postback event registration & testing
├── middlewares/    # Authentication, capability guards, and validation
├── routes/         # Modular Express router declarations
├── services/       # Core business logic and database transaction services
├── tests/          # Comprehensive end-to-end API integration test suite
├── app.ts          # Express application setup, CORS, and middleware routing
└── index.ts        # Production HTTP listener entry point
prisma/
├── migrations/     # Versioned PostgreSQL migration scripts
└── schema.prisma   # Relational data model definitions & native enums
```

---

## 🌐 Production REST API Endpoints

### 🏢 B2B Enterprise Organizations & Multi-User RBAC
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/organizations` | Creates an enterprise organization bound to owner's Stellar wallet. |
| `GET` | `/api/organizations/:id` | Retrieves organization profile, active members, campaigns, and webhooks. |
| `GET` | `/api/organizations/owner/:walletAddress` | Lists all organizations owned by or linked to a Stellar wallet. |
| `POST` | `/api/organizations/:id/members` | Invites a team member with defined role (`ADMIN`, `MARKETING_MANAGER`, `EDITOR`, `FINANCE`, `VIEWER`). |
| `GET` | `/api/organizations/:id/members` | Lists active team members and verification statuses. |
| `DELETE` | `/api/organizations/:id/members/:memberId` | Revokes organization membership and access capabilities. |

### 📢 Campaigns & Audience Separation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/campaigns` | Creates a new campaign with explicit `audience` (`B2B` or `B2C`), budget, currency, and escrow period. |
| `GET` | `/api/campaigns` | Lists all campaigns with optional query filters (`?audience=B2B` or `?organizationId=...`). |
| `GET` | `/api/campaigns/:id` | Returns campaign details with linked advertiser and organization relations. |

### 👥 B2C Two-Tier Referral Network
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/referrals` | Registers recruiter/sub-affiliate relationship with cycle prevention. |
| `GET` | `/api/referrals/recruiter/:recruiterAddress` | Returns two-tier hierarchy tree, recruit counts, and aggregate sales volume. |
| `POST` | `/api/referrals/commission-split` | Calculates exact commission splits in XLM and Stroops (10^7) between seller and recruiter. |
| `POST` | `/api/referrals/record-sale` | Records conversion volume and updates recruiter override balances. |

### 🛡️ Real-Time Fraud Telemetry & Velocity Anomaly Scoring
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/fraud/eval` | Evaluates click-to-conversion time delta, Z-score velocity burst, and assigns risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| `GET` | `/api/fraud/affiliate/:affiliateAddress` | Returns affiliate risk profile, historical evaluations, and pause state. |
| `POST` | `/api/fraud/affiliate/:affiliateAddress/pause` | Toggles affiliate pause status to protect advertiser escrow pools. |

### 🔗 Tracked Short Links & Redirection Engine
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/links` | Generates a tracked short link with custom or randomized alphanumeric slug. |
| `GET` | `/api/links/:slug` | Resolves target URL, increments click counter, logs IP hash, and preserves subId parameters. |
| `GET` | `/api/links/affiliate/:affiliateWallet` | Lists all active short links created by an affiliate. |

### 📡 Enterprise Webhooks & Event Postbacks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/webhooks` | Registers a webhook destination endpoint with secret and event subscriptions. |
| `GET` | `/api/webhooks/organization/:orgId` | Lists all configured webhooks for an organization. |
| `POST` | `/api/webhooks/:id/test-ping` | Dispatches a signed HMAC-SHA256 test ping (`StormSale-Signature`) to verify destination connectivity. |

### 👤 User Authentication & Profiles
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/users` | Registers or authenticates a Stellar ed25519 wallet address (`G...`). |
| `GET` | `/api/users/:walletAddress` | Retrieves user profile, assigned role, and created campaigns. |
| `GET` | `/health` | Service operational health check and timestamp probe. |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ or v22 LTS recommended)
- [PostgreSQL](https://www.postgresql.org/) (v16+) or [Neon Serverless Postgres](https://neon.tech/)
- [Docker](https://www.docker.com/) & Docker Compose (optional for containerized deployment)

### 1. Local Development

```bash
# Clone the repository
git clone https://github.com/StormSale/StormSale-backend.git
cd StormSale-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Generate Prisma client and deploy schema
npm run build
npm run prisma:migrate

# Start development server with hot-reload
npm run dev
```

### 2. Running Integration Tests

The test suite runs with an in-memory mock store, requiring zero external database setup:

```bash
npm test
```

### 3. Production Deployment with Docker Compose

Spin up the complete production stack (Node.js API, PostgreSQL 16 with persistent volume, and Redis 7):

```bash
docker compose up -d --build
```

Verify service health:
```bash
curl http://localhost:3000/health
```

---

## 👥 Maintainers

| Avatar | Name / Role | GitHub | Contact |
| :---: | :---: | :---: | :---: |
| <img src="https://github.com/AbuJulaybeeb.png" width="80" style="border-radius:50%" /> | **Jibril Raji Qasim (AJDEV)**<br/>*Lead Backend Developer* | [@AbuJulaybeeb](https://github.com/AbuJulaybeeb) | [Telegram](https://t.me/AJDEV_Official) |

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
