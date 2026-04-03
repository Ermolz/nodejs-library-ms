# Library MS

Educational project - Library Management System API built with Node.js, Express, TypeScript, Prisma, SQLite, JWT auth, password reset, and avatar uploads.

## Docs

- API documentation: [docs/README.md](docs/README.md)
- Postman collection: [docs/postman/Library-MS.postman_collection.json](docs/postman/Library-MS.postman_collection.json)

## Setup

1. Copy `.env.example` to `.env`
2. Fill in database, JWT, and SMTP variables
3. Run `npm install`
4. Run `npm run db:migrate`
5. Run `npm run dev`

## Features

- Books and loans persisted in SQLite via Prisma
- Registration, login, JWT auth, refresh tokens
- Password reset via SMTP email and one-time DB-backed reset tokens
- Avatar upload, replacement, deletion, and static file serving
- ADMIN-protected routes for books and user listings

## Notes

- To create an ADMIN user, register normally and then update `role` in the database
- Uploaded avatars are stored in `uploads/avatars/` and are ignored by git
