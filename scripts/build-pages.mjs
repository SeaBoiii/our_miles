import { cp, mkdir, readFile, realpath, rm, symlink, writeFile, readdir, lstat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const stage = path.join(workspace, ".pages-build");
const output = path.join(workspace, "out");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/our_miles").replace(/\/$/, "");
if (basePath && (!/^\/[a-zA-Z0-9_./-]+$/.test(basePath) || basePath.includes("//") || basePath.split("/").some((part) => part === "." || part === ".."))) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be a safe absolute URL path, or empty for a custom domain.");
}

// Only the project's publishable key may enter the public bundle.
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!publicUrl || !publicKey) throw new Error("Pages requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use public project configuration only.");
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)) throw new Error("Pages accepts only a Supabase publishable key. Never provide a secret or service-role key.");
let supabaseOrigin = "";
if (publicUrl) {
  let parsed;
  try { parsed = new URL(publicUrl); } catch { throw new Error("The Pages Supabase URL must be a valid HTTPS origin."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("The Pages Supabase URL must be an HTTPS origin without credentials, path, query or fragment.");
  supabaseOrigin = parsed.origin;
}

async function resetOwnedDirectory(target) {
  const resolved = path.resolve(target);
  if (![stage, output].includes(resolved) || path.dirname(resolved) !== workspace) throw new Error("Refusing to remove a path outside the generated Pages directories.");
  try {
    const details = await lstat(resolved);
    if (details.isSymbolicLink()) throw new Error("Refusing to remove a generated directory that is a symbolic link.");
    const physical = await realpath(resolved);
    if (physical !== resolved) throw new Error("Refusing to remove a generated directory with an unexpected physical path.");
    await rm(resolved, { recursive: true, force: true });
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}

await resetOwnedDirectory(stage);
await mkdir(stage, { recursive: true });
const excludedSource = [path.join(workspace, "src", "app", "api"), path.join(workspace, "src", "lib", "server")];
await cp(path.join(workspace, "src"), path.join(stage, "src"), {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith(".env") && !excludedSource.some((excluded) => source === excluded || source.startsWith(`${excluded}${path.sep}`)),
});
await cp(path.join(workspace, "public"), path.join(stage, "public"), { recursive: true, filter: (source) => !path.basename(source).startsWith(".env") });
for (const file of ["package.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs"]) {
  await cp(path.join(workspace, file), path.join(stage, file));
}
// A junction reuses installed dependencies on Windows without copying them or following arbitrary folders.
await symlink(path.join(workspace, "node_modules"), path.join(stage, "node_modules"), process.platform === "win32" ? "junction" : "dir");

const stylesPath = path.join(stage, "src", "app", "globals.css");
const styles = await readFile(stylesPath, "utf8");
await writeFile(stylesPath, styles.replace(/url\((["'])\/fonts\//g, `url($1${basePath}/fonts/`));
const offlinePath = path.join(stage, "public", "offline.html");
const offline = await readFile(offlinePath, "utf8");
await writeFile(offlinePath, offline.replace('src="/icons/', `src="${basePath}/icons/`).replace('href="/"', `href="${basePath}/"`));

const buildEnv = { ...process.env, OUR_MILES_PAGES_EXPORT: "true", NEXT_PUBLIC_HOSTING_MODE: "pages", NEXT_PUBLIC_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of Object.keys(buildEnv)) {
  if ((key.startsWith("OUR_MILES_") && key !== "OUR_MILES_PAGES_EXPORT") ||
    (key.startsWith("NEXT_PUBLIC_") && !["NEXT_PUBLIC_BASE_PATH", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_HOSTING_MODE"].includes(key)) ||
    key.startsWith("SUPABASE_") || /^(DATABASE_URL|POSTGRES_URL)$/.test(key)) delete buildEnv[key];
}
const nextCli = path.join(workspace, "node_modules", "next", "dist", "bin", "next");
const code = await new Promise((resolve, reject) => {
  // Webpack supports the shared dependency junction; Turbopack disallows links outside its root.
  const child = spawn(process.execPath, [nextCli, "build", "--webpack"], { cwd: stage, env: buildEnv, stdio: "inherit", windowsHide: true });
  child.once("error", reject);
  child.once("exit", (status) => resolve(status ?? 1));
});
if (code !== 0) process.exit(code);

const stagedOutput = path.join(stage, "out");
const entries = await readdir(stagedOutput);
if (!entries.includes("index.html") || entries.includes("api")) throw new Error("The Pages export must contain an application shell and no API route output.");

async function protectStaticHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) { await protectStaticHtml(target); continue; }
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const html = await readFile(target, "utf8");
    const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((match) => !/\bsrc\s*=/i.test(match[1]))
      .map((match) => `'sha256-${createHash("sha256").update(match[2], "utf8").digest("base64")}'`);
    const policy = [
      "default-src 'self'",
      `script-src 'self' ${[...new Set(hashes)].join(" ")}`.trim(),
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
      "img-src 'self' data:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join("; ");
    // Pages cannot send custom security headers. Script hashes allow Next's generated hydration only.
    // frame-ancestors is omitted: browsers do not enforce that directive in a meta tag.
    const security = `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="same-origin">`;
    if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error(`Static HTML has no head: ${entry.name}`);
    await writeFile(target, html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${security}`));
  }
}
await protectStaticHtml(stagedOutput);
await resetOwnedDirectory(output);
await cp(stagedOutput, output, { recursive: true });
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Static Pages export ready in out (base path: ${basePath || "/"}). No .env files or server API routes were copied.`);
