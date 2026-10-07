import { NextRequest } from "next/server";
import {
  createSession,
  getAuthConfiguration,
  loginIdentity,
  loginLimiters,
  pinMatches,
  SESSION_COOKIE,
  verifySession,
} from "@/lib/server/auth";
import {
  privateJson,
  readJson,
  RequestBodyError,
  sameOrigin,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const configuration = getAuthConfiguration();
  if (configuration.mode === "configuration-error") {
    return privateJson(
      {
        mode: "private",
        authenticated: false,
        owner: null,
        error: "Private access is not configured. Check the server settings.",
      },
      503,
    );
  }
  if (configuration.mode === "demo")
    return privateJson({ mode: "demo", authenticated: false, owner: null });
  const session = verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
    configuration.secret,
  );
  return privateJson({
    mode: "private",
    authenticated: Boolean(session),
    owner: session?.owner ?? null,
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ error: "Open Our Miles directly to sign in." }, 403);
  const configuration = getAuthConfiguration();
  if (configuration.mode === "configuration-error")
    return privateJson(
      { error: "Private access is not configured. Check the server settings." },
      503,
    );
  if (configuration.mode === "demo")
    return privateJson(
      { error: "This is a demo. Private sign-in is not enabled." },
      403,
    );

  const total = loginLimiters.total.consume("all");
  const individual = loginLimiters.individual.consume(loginIdentity(request));
  if (!total.allowed || !individual.allowed) {
    const retryAfter = Math.max(total.retryAfter, individual.retryAfter);
    return privateJson(
      { error: "Too many attempts. Please try again in a little while." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }
  let data: unknown;
  try {
    data = await readJson(request, 2048);
  } catch (error) {
    if (error instanceof RequestBodyError)
      return privateJson({ error: error.message }, error.status);
    throw error;
  }
  if (!data || typeof data !== "object")
    return privateJson(
      { error: "Enter your private PIN and choose a person." },
      400,
    );
  const body = data as Record<string, unknown>;
  if (
    typeof body.pin !== "string" ||
    !/^\d{6,12}$/.test(body.pin) ||
    (body.owner !== "aleem" && body.owner !== "nurul") ||
    typeof body.remember !== "boolean" ||
    Object.keys(body).some((key) => !["pin", "owner", "remember"].includes(key))
  )
    return privateJson(
      { error: "Enter your private PIN and choose a person." },
      400,
    );
  if (!pinMatches(body.pin, configuration.pin))
    return privateJson({ error: "That PIN does not match. Try again." }, 401);

  const { token, maxAge } = createSession(
    body.owner,
    body.remember,
    configuration.secret,
  );
  const response = privateJson({
    mode: "private",
    authenticated: true,
    owner: body.owner,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(body.remember ? { maxAge } : {}),
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ error: "Open Our Miles directly to sign out." }, 403);
  const response = privateJson({ authenticated: false, owner: null });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
