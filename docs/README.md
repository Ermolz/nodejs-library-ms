# Library Management System API

Base URL: `http://localhost:3000`

Protected routes require the header `Authorization: Bearer <token>`.

Status codes:
- `400 Bad Request` - validation error or business rule violation
- `401 Unauthorized` - missing, invalid, or expired token
- `403 Forbidden` - authenticated user does not have enough permissions
- `404 Not Found` - entity was not found

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

### Register body

```json
{
  "email": "user@example.com",
  "password": "securePass123",
  "name": "Ivan Petrenko"
}
```

Validation:
- `email` must be a valid email
- `password` must be at least 8 characters
- `name` is required

### Login body

```json
{
  "email": "user@example.com",
  "password": "securePass123"
}
```

Validation:
- `email` must be a valid email
- `password` must be at least 8 characters

### Refresh body

```json
{
  "refreshToken": "your-refresh-token"
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
    "role": "USER"
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

### Create book body

```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "year": 2008,
  "isbn": "9780132350884"
}
```

Validation:
- `title` is required
- `author` is required
- `year` must be an integer greater than 0
- `isbn` is required and must be unique

### Update book body

All fields are optional.

```json
{
  "title": "Clean Code (Updated)",
  "year": 2009
}
```

## Users

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| GET | `/users` | Get all users | ADMIN |
| GET | `/users/:id` | Get user by id | ADMIN |
| GET | `/users/me` | Get current authenticated user | Authenticated |

Notes:
- `passwordHash` is never returned in API responses
- user role is `USER` or `ADMIN`

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

### Borrow book body

```json
{
  "bookId": "book-id"
}
```

Business rules:
- a book must exist
- a user must exist
- a book cannot be borrowed if `available = false`
- a book cannot have another active loan
- when borrowed, the book becomes unavailable
- when returned, the loan status becomes `RETURNED` and the book becomes available again

## Local setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Set `JWT_SECRET` to at least 32 characters
4. Optionally set `JWT_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_DAYS`
5. Run `npm run db:migrate`
6. Run `npm run dev`

To create an admin user:
- register a normal user via `/auth/register`
- update its `role` to `ADMIN` in the database
