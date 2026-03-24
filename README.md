# Library MS

Educational project — Library Management System API (Node.js, Express, TypeScript).

**API documentation:** [docs/README.md](docs/README.md)

**Setup:** Copy `.env.example` to `.env`, set `DATABASE_URL` and `JWT_SECRET` (min 32 chars). Run `npm run db:migrate`, then `npm run dev`. To create an ADMIN user, register via POST `/auth/register` then set `role` to `ADMIN` in the database (e.g. with SQLite or Prisma Studio).
