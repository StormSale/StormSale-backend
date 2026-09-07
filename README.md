<div align="center">
  <h1>⚡ StormSale API Backend</h1>
  <p><strong>Cloud-Native Node.js & Neon PostgreSQL Indexing Service for StormSale</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20Postgres-336791?logo=postgresql)](https://neon.tech/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Ready-blue?logo=docker)](Dockerfile)
</div>

<br />

## 📖 Overview

The **StormSale Backend** is an isolated microservice that indexes on-chain Soroban events, manages off-chain campaign metadata, and stores user profile configurations. 

It is designed for cloud-native deployment using **Neon Serverless PostgreSQL**, **Prisma ORM**, and **Express / TypeScript**.

---

## 🏗️ Architecture & Modules

```text
src/
├── controllers/    # Request handlers for users and campaigns
├── routes/         # Express API routing definitions
├── prisma/         # Prisma schema and Neon client
└── index.ts        # Server entry point, CORS, and middleware
```

### API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/users/register` | Registers a connected Stellar wallet and role profile. |
| `GET` | `/api/users/:wallet` | Fetches user profile, role, and settings. |
| `POST` | `/api/campaigns` | Saves off-chain campaign metadata linked to on-chain ID. |
| `GET` | `/api/campaigns` | Lists all active indexed affiliate campaigns. |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Neon Serverless PostgreSQL Account](https://neon.tech/)

### 1. Local Setup

```bash
# Clone and install dependencies
git clone https://github.com/StormSale/StormSale-backend.git
cd StormSale-backend
npm install

# Setup environment variables
cp .env.example .env
# Edit .env and paste your Neon connection string

# Synchronize database schema
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```
The API server runs at `http://localhost:3000`.

### 2. Running with Docker

```bash
# Build Docker image
docker build -t stormsale-backend .

# Run container
docker run -p 3000:3000 --env-file .env stormsale-backend
```

---

## 👥 Maintainers

| Avatar | Name / Role | GitHub | Contact |
| :---: | :---: | :---: | :---: |
| <img src="https://github.com/AbuJulaybeeb.png" width="80" style="border-radius:50%" /> | **Jibril Raji Qasim (AJDEV)**<br/>*Lead Backend Developer* | [@AbuJulaybeeb](https://github.com/AbuJulaybeeb) | [Telegram](https://t.me/AJDEV_Official) |

---

## 🤝 Contributing & Security

- Review [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
- Review [SECURITY.md](SECURITY.md) for security vulnerability reporting.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
