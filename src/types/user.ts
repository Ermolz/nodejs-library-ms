export type Role = 'USER' | 'ADMIN';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}
