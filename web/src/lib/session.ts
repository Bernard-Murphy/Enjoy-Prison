import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export interface AuthPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "epgames-jwt-secret-key-change-me";

export function signJWT(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyJWT(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return randomUUID();
}
