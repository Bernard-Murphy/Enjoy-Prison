import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";
import { createApolloServer } from "@/lib/graphql/apollo-server";
import { verifyJWT } from "@/lib/session";
import type { Context } from "@/lib/graphql/resolvers";
import { prisma } from "@/lib/prisma";

const server = createApolloServer();

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/session-id=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

const handler = startServerAndCreateNextHandler(server, {
  context: async (req: NextRequest): Promise<Context> => {
    const headers = req.headers;
    const authHeader = headers.get("authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      const cookieHeader = headers.get("cookie");
      const match = cookieHeader?.match(/auth-token=([^;]+)/);
      token = match ? match[1] : null;
    }
    const user = token ? verifyJWT(token) : null;
    let sessionId = getSessionIdFromCookie(headers.get("cookie") ?? null);
    if (!user && !sessionId) {
      try {
        const session = await prisma.session.create({ data: {} });
        sessionId = session.uuid;
        (req as NextRequest & { newSessionId?: string }).newSessionId =
          sessionId;
      } catch {
        // ignore
      }
    }
    return {
      user: user ? { userId: user.userId } : null,
      sessionId,
      req,
    };
  },
});

async function withSessionCookie(
  request: NextRequest,
  response: Response,
): Promise<Response> {
  const sessionId = getSessionIdFromCookie(
    request.headers.get("cookie") ?? null,
  );
  const reqWithNew = request as NextRequest & { newSessionId?: string };
  if (reqWithNew.newSessionId) {
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    newResponse.headers.set(
      "Set-Cookie",
      `session-id=${encodeURIComponent(reqWithNew.newSessionId)}; path=/; max-age=2592000; samesite=lax`,
    );
    return newResponse;
  }
  return response;
}

export async function GET(request: NextRequest) {
  const response = await handler(request);
  return withSessionCookie(request, response);
}

export async function POST(request: NextRequest) {
  const response = await handler(request);
  return withSessionCookie(request, response);
}
