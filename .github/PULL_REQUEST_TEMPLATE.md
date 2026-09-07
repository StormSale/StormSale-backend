## Description

<!-- Briefly describe the backend API endpoints, Prisma schema migrations, or Stellar validation changes. -->

## Linked Issue

Closes #<!-- Issue number if applicable -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change adding backend API capabilities)
- [ ] 🗄️ Database migration (Prisma schema update)
- [ ] 🔒 Security / Validation update (Zod schema hardening)
- [ ] 🧪 Tests (adding unit/integration test coverage)
- [ ] 📚 Documentation update

## Backend Checklist

- [ ] TypeScript compilation succeeds with zero errors (`npm run build`)
- [ ] Automated validation test suite passes (`npm test`)
- [ ] Database schema changes are validated with Prisma (`npx prisma validate`)
- [ ] Stellar address validation strictly enforced (RFC 4648 Base32 `G...` keys and `C...` contract IDs)
- [ ] No secrets, database passwords, or private keys committed
- [ ] Error handling returns proper HTTP status codes and structured JSON

## Verification & Testing

<!-- Detail the exact commands run and API endpoints verified -->
```bash
npm run build
npm test
```
