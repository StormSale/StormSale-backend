# StormSale Backend

This is the isolated Node.js backend for the StormSale affiliate platform. It uses Express, TypeScript, Prisma, and SQLite (for easy local setup).

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup the environment:
   The database URL is automatically set to local SQLite (`file:./dev.db`) in the `.env` file and `prisma.config.ts`.
   
   Run the database migrations to generate the local `.db` file:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

### Running the Server

**Development Mode:**
```bash
npm run dev
```
Starts the server on `http://localhost:3001` with hot-reloading.

**Production Build:**
```bash
npm run build
npm start
```

## API Modules
- `/api/users` - Register wallets, assign roles, and fetch profiles.
- `/api/campaigns` - Store off-chain campaign metadata (tags, descriptions) linked to on-chain IDs.

## Note for Contributors
The current database is `SQLite` to allow zero-config setup for all contributors joining from the **Drips wave**. When we move to production, we will migrate the `provider` in `prisma/schema.prisma` to `postgresql` and update the `DATABASE_URL`.
