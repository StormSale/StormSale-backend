# Backend Security Policy

## Reporting Vulnerabilities

If you discover a vulnerability affecting the StormSale API backend (e.g., SQL injection, authorization bypass, sensitive data leakage), please report it responsibly:

- **Security Email**: `abujulaybeeb08@gmail.com`
- **Response SLA**: Initial triage within 48 hours.
- **Please do not file public issues** for unpatched security issues.

---

## Security Practices

- **Zero-Secret Commits**: Production database connection strings are managed strictly via environment variables.
- **Prisma SQL Sanitization**: Parameterized queries via Prisma prevent SQL injection.
- **CORS & Headers**: Strict CORS policy restricted to the trusted frontend origins.
