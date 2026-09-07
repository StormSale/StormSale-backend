# Contributing to StormSale Backend

Welcome to the **StormSale Backend** service repository. The backend provides off-chain metadata caching, campaign indexing, and user profile management for the StormSale Web3 affiliate platform.

---

## Architecture & Tech Stack

- **Runtime**: Node.js v20+ / TypeScript
- **Framework**: Express.js
- **Database ORM**: Prisma ORM
- **Database Engine**: Neon Serverless PostgreSQL (Cloud-native)
- **Containerization**: Docker Alpine

---

## Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Synchronize Prisma schema with database
npx prisma generate
npx prisma db push

# 4. Start development server
npm run dev
```

---

## Contribution & PR Standards

1. Follow standard Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
2. Ensure strict TypeScript compilation (`npm run build`).
3. Run linter before pushing (`npm run lint`).
4. Avoid committing `.env` files or database connection secrets.
