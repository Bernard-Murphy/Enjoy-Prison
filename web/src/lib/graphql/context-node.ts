import type { IncomingMessage } from "http";
import { verifyJWT } from "../session";
import { prisma } from "../prisma";
import type { Context } from "./resolvers";

function getHeader(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name];
  if (v == null) return null;
  return Array.isArray(v) ? v[0] : v;
}

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/session-id=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export interface ContextResult {
  context: Context;
  newSessionId?: string;
}

export async function buildContextFromNodeRequest(
  req: IncomingMessage,
): Promise<ContextResult> {
  const authHeader = getHeader(req, "authorization");
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const cookieHeader = getHeader(req, "cookie");
    const match = cookieHeader?.match(/auth-token=([^;]+)/);
    token = match ? match[1] : null;
  }
  const user = token ? verifyJWT(token) : null;
  let sessionId = getSessionIdFromCookie(getHeader(req, "cookie") ?? null);
  let newSessionId: string | undefined;
  if (!user && !sessionId) {
    try {
      const session = await prisma.session.create({ data: {} });
      sessionId = session.uuid;
      newSessionId = session.uuid;
    } catch {
      // ignore
    }
  }
  return {
    context: {
      user: user ? { userId: user.userId } : null,
      sessionId,
      req: req as unknown as Request,
    },
    newSessionId,
  };
}
