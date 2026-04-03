import { Role } from '@prisma/client';
import { UserResponse } from '../types/user';

export function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: Role | 'USER' | 'ADMIN';
  avatarUrl: string | null;
}): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    avatarUrl: user.avatarUrl,
  };
}
