# Library Management System — API

Base URL: `http://localhost:3000`

## Books

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| GET    | /books        | List all books     |
| GET    | /books/:id    | Get book by ID     |
| POST   | /books        | Create book        |
| PUT    | /books/:id    | Update book        |
| DELETE | /books/:id    | Delete book        |

**POST/PUT body (book):** `title`, `author`, `year` (number), `isbn` (PUT — all fields optional).

## Users

| Method | Endpoint     | Description           |
|--------|--------------|-----------------------|
| GET    | /users       | List all users        |
| GET    | /users/:id   | Get user by ID        |
| POST   | /users       | Create user           |

**POST body (user):** `name`, `email`.

## Loans

| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| GET    | /loans             | List all loans     |
| POST   | /loans             | Borrow book        |
| POST   | /loans/:id/return  | Return book        |

**POST /loans body:** `userId`, `bookId` (UUID from GET /books and GET /users).

**Errors:** `400` — validation or business rule, `404` — resource not found. Body: `{ "error": "string" }`.
