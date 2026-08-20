import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";

export const SESSION_COOKIE = "patchwork_session";

/** Thirty days. Long enough that a regular reporter is not re-typing a password. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const isProduction = (): boolean => process.env["NODE_ENV"] === "production";

/**
 * The cookie carries a random token; the database stores only its SHA-256.
 *
 * A plain digest is right here where it would be wrong for a password: the
 * token is 256 bits of randomness, so there is no guessing attack to slow
 * down — the only job is making a leaked `sessions` table useless.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** What the API is willing to say about a user. Never the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<User> {
  const [user] = await db
    .insert(usersTable)
    .values({
      id: randomUUID(),
      email: params.email.trim(),
      emailNormalized: normalizeEmail(params.email),
      passwordHash: params.passwordHash,
      displayName: params.displayName,
    })
    .returning();

  // The insert has no ON CONFLICT, so a returning() that yields nothing would
  // mean the row vanished between statements rather than a duplicate email.
  if (!user) throw new Error("Failed to create user");
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.emailNormalized, normalizeEmail(email)))
    .limit(1);
  return user;
}

/** Issues a session and sets the cookie. Returns nothing — the cookie is the point. */
export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessionsTable).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // Blocks the token from JavaScript, so an XSS bug cannot read it.
    secure: isProduction(),
    // 'lax' still sends the cookie on top-level navigation to the app while
    // withholding it from cross-site POSTs, which is the CSRF case that
    // matters for the write routes.
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readToken(req);
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
  });
}

function readToken(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const value = cookies?.[SESSION_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function resolveUser(req: Request): Promise<User | undefined> {
  const token = readToken(req);
  if (!token) return undefined;

  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.tokenHash, hashToken(token)),
        // Expiry is checked in the query, not in JavaScript afterwards, so an
        // expired session can never be treated as valid by a code path that
        // forgets to look.
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row?.user;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Resolves the session on every request without demanding one.
 *
 * Public routes need this so they can tailor a response to a signed-in
 * visitor; it never rejects.
 */
export const attachUser: RequestHandler = (req, _res, next) => {
  void resolveUser(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(next);
};

/** Rejects anonymous callers. Put this only on routes that write. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "You need to be signed in to do that" });
    return;
  }
  next();
}

/**
 * Drops sessions that have already expired.
 *
 * Expired rows are never *honoured* — resolveUser filters them out — so this
 * is housekeeping, not a security control.
 */
export async function purgeExpiredSessions(): Promise<number> {
  const deleted = await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()))
    .returning({ tokenHash: sessionsTable.tokenHash });
  return deleted.length;
}
