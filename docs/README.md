# Library Management System API

Base URL: `http://localhost:3000`

Protected routes require the header `Authorization: Bearer <token>`.
Static avatar files are served from `/uploads`.

Status codes:
- `400 Bad Request` - validation error, invalid file, or business rule violation
- `401 Unauthorized` - missing, invalid, or expired token
- `403 Forbidden` - authenticated user does not have enough permissions
- `404 Not Found` - entity or avatar was not found

Error response format:

```json
{
  "error": "string"
}
```

## Auth

Public endpoints:

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive tokens |
| POST | `/auth/refresh` | Exchange a refresh token for a new access token |
| POST | `/auth/request-password-reset` | Request a password reset email |
| POST | `/auth/reset-password` | Set a new password using reset token |

### Register body

```json
{
  "email": "user@example.com",
  "password": "securePass123",
  "name": "Ivan Petrenko"
}
```

### Login body

```json
{
  "email": "user@example.com",
  "password": "securePass123"
}
```

### Refresh body

```json
{
  "refreshToken": "your-refresh-token"
}
```

### Request password reset body

```json
{
  "email": "user@example.com"
}
```

Successful response is always:

```json
{
  "message": "Якщо вказаний email зареєстрований, лист з інструкціями надіслано."
}
```

### Reset password body

```json
{
  "token": "raw-reset-token",
  "password": "newSecurePassword123"
}
```

Success response:

```json
{
  "message": "Пароль успішно змінено."
}
```

### Successful register/login/refresh response

```json
{
  "token": "jwt-access-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "Ivan Petrenko",
    "role": "USER",
    "avatarUrl": null
  }
}
```

## Books

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/books` | Get all books | Public |
| GET | `/books/:id` | Get book by id | Public |
| POST | `/books` | Create a book | ADMIN |
| PUT | `/books/:id` | Update a book | ADMIN |
| DELETE | `/books/:id` | Delete a book | ADMIN |

## Users

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/users` | Get all users | ADMIN |
| GET | `/users/:id` | Get user by id | ADMIN |
| GET | `/users/me` | Get current authenticated user | Authenticated |
| POST | `/users/me/avatar` | Upload or replace avatar | Authenticated |
| DELETE | `/users/me/avatar` | Delete avatar | Authenticated |

User responses include:
- `id`
- `name`
- `email`
- `role`
- `avatarUrl`

### Upload avatar

Request type: `multipart/form-data`

Field:
- `avatar` - JPEG or PNG image, max 5 MB

Successful response:

```json
{
  "message": "Аватарку успішно оновлено.",
  "avatarUrl": "/uploads/avatars/userid-123456789.jpg"
}
```

Delete avatar response:

```json
{
  "message": "Аватарку видалено."
}
```

## Loans

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/loans` | Get loans | Authenticated |
| POST | `/loans` | Borrow a book | Authenticated |
| POST | `/loans/:id/return` | Return a loan | Authenticated |

Behavior:
- `ADMIN` sees all loans in `GET /loans`
- `USER` sees only their own loans in `GET /loans`
- `POST /loans` always creates a loan for the authenticated user
- `USER` can return only their own loan
- `ADMIN` can return any loan

## Local setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Set `JWT_SECRET` to at least 32 characters
4. Set SMTP variables and `SENDER_EMAIL`
5. Set `APP_BASE_URL`
6. Run `npm install`
7. Run `npm run db:migrate`
8. Run `npm run dev`
