# Backend Security Policy

## 🛡 Overview

The StormSale Backend API is the high-performance off-chain coordination and caching layer for the StormSale decentralized protocol on Stellar. This document defines our security standards, threat model, response SLAs, and vulnerability disclosure process for the API and database services.

---

## 📦 Supported Versions

| Version | Supported          | Status                              |
| :------ | :----------------- | :---------------------------------- |
| 1.0.x   | :white_check_mark: | Active production release           |
| < 1.0.0 | :x:                | Deprecated                          |

---

## 🔒 Defense-in-Depth & Threat Model

The backend microservice implements strict defense-in-depth controls across every layer:

### 1. SQL / ORM Injection Prevention
- All database operations are executed exclusively through the **Prisma ORM** query engine, utilizing parameterized queries.
- Raw SQL concatenation (`$queryRawUnsafe`) is strictly prohibited throughout the codebase.

### 2. Strict Input Validation & Schema Gating
- Every HTTP request body, query parameter, and route parameter is validated using strict **Zod schemas** before reaching controller logic.
- Input fields enforce explicit length boundaries (e.g., campaign title min 3 / max 100 characters; description min 10 / max 1000 characters).
- Excess or unknown fields in request payloads are rejected.

### 3. Stellar Cryptographic Address Validation
- Addresses are strictly validated against the 56-character base32 Stellar ed25519 public key format (`G...`).
- Foreign addresses (including EVM `0x...` hex strings, malformed lengths, or invalid checksums) are immediately rejected with `HTTP 400 Bad Request`.

### 4. Zero-Secret Architecture
- Production database URLs (`DATABASE_URL`), server ports, and environment flags are injected solely via environment variables.
- Git commits are verified with automated hygiene to ensure zero accidental credential leakage.

### 5. Denial of Service (DoS) Protections
- Express JSON body parsers enforce bounded payload size limits.
- Ephemeral test listeners and route handlers fail safely on unexpected runtime exceptions.

### 6. Cross-Origin Resource Sharing (CORS)
- CORS middleware is configured to restrict cross-origin access strictly to authorized frontend origins.

---

## 🚨 Reporting Vulnerabilities

If you discover a vulnerability affecting the StormSale API backend (such as SQL injection, authentication bypass, unauthorized data access, or denial of service), please report it via coordinated disclosure.

### 📬 Reporting Channels
- **Primary Email**: `security@stormsale.io`
- **Lead Maintainer**: `abujulaybeeb08@gmail.com`
- **GitHub Security Advisories**: Submit a private advisory directly on the **Security** tab of the `StormSale-backend` repository.

### 📋 Information to Include
1. Summary and potential impact of the vulnerability.
2. Endpoint(s) and HTTP methods affected (e.g., `POST /api/users`, `POST /api/campaigns`).
3. Detailed proof-of-concept (curl command, HTTP request payload, or reproduction script).
4. Any potential fixes or mitigations.

---

## ⏱️ Response Timelines & SLA

| Milestone | Target SLA | Description |
| :--- | :--- | :--- |
| **Initial Triage** | **Within 24 hours** | Acknowledgment of report receipt. |
| **Severity Assessment** | **Within 48 hours** | Verification of vulnerability and CVSS scoring. |
| **Remediation & Patch** | **Within 5 business days** | Development, testing, and deployment of security patch. |

---

## ⚖️ Severity Ratings

| Severity | Definition & Examples |
| :--- | :--- |
| **Critical** | Remote code execution (RCE); database credential extraction; unauthorized manipulation of campaign records. |
| **High** | Authentication bypass; authorization spoofing allowing non-advertisers to mutate campaigns; denial of service (server crash). |
| **Medium** | Information disclosure of non-public campaign drafts; missing rate limits on sensitive endpoints. |
| **Low** | Verbose error stack traces in non-production environments; minor schema discrepancies. |
