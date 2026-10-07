import { NextRequest } from "next/server";
import {
  getAuthConfiguration,
  SESSION_COOKIE,
  verifySession,
} from "@/lib/server/auth";
import {
  privateJson,
  readJson,
  RequestBodyError,
  sameOrigin,
} from "@/lib/server/http";
import { createStateStore, VersionConflict } from "@/lib/server/storage";
import {
  parseAppState,
  snapshotsPreserved,
  stateUpdateSchema,
} from "@/lib/server/state-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorise(request: NextRequest) {
  const configuration = getAuthConfiguration();
  if (configuration.mode === "configuration-error")
    return privateJson({ error: "Private access is not configured." }, 503);
  if (configuration.mode === "demo")
    return privateJson(
      {
        error: "The demo uses this browser only. Private storage is disabled.",
      },
      403,
    );
  if (
    !verifySession(
      request.cookies.get(SESSION_COOKIE)?.value,
      configuration.secret,
    )
  ) {
    return privateJson({ error: "Sign in to open your shared wallet." }, 401);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorise(request);
  if (denied) return denied;
  try {
    return privateJson(await createStateStore(parseAppState).read());
  } catch {
    return privateJson(
      {
        error:
          "Your shared wallet could not be loaded. Check the connection and server storage.",
      },
      503,
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = authorise(request);
  if (denied) return denied;
  if (!sameOrigin(request))
    return privateJson(
      { error: "Open Our Miles directly to save changes." },
      403,
    );
  let data: unknown;
  try {
    data = await readJson(request);
  } catch (error) {
    if (error instanceof RequestBodyError)
      return privateJson({ error: error.message }, error.status);
    throw error;
  }
  const parsed = stateUpdateSchema.safeParse(data);
  if (!parsed.success)
    return privateJson(
      {
        error:
          "The wallet update contains invalid data. Check the dates, amounts and linked cards.",
      },
      422,
    );
  try {
    const store = createStateStore(parseAppState);
    const current = await store.read();
    if (parsed.data.version !== current.version) throw new VersionConflict();
    if (!snapshotsPreserved(current.state, parsed.data.state)) {
      return privateJson(
        {
          error:
            "Recorded reward calculations cannot be overwritten. Reverse the purchase and add a corrected record.",
        },
        422,
      );
    }
    return privateJson(
      await store.write(parsed.data.version, parsed.data.state),
    );
  } catch (error) {
    if (error instanceof VersionConflict)
      return privateJson({ error: error.message }, 409);
    return privateJson(
      {
        error:
          "Your changes were not saved. Check the connection and server storage, then try again.",
      },
      503,
    );
  }
}
