import { User } from '../types/user';

const users = new Map<string, User>();

export function getAll(): User[] {
  return Array.from(users.values());
}

export function getById(id: string): User | undefined {
  return users.get(id);
}

export function create(data: Omit<User, 'id'>): User {
  const id = crypto.randomUUID();
  const user: User = { ...data, id };
  users.set(id, user);
  return user;
}
