import { Router, type IRouter } from "express";
import { SignUpBody, LogInBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, fakeVerify } from "../lib/passwords";
import {
  createUser,
  findUserByEmail,
  startSession,
  endSession,
  toPublicUser,
} from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function firstIssue(error: { issues?: Array<{ message: string }> }): string {
  return error.issues?.[0]?.message ?? "Invalid details";
}

router.post("/auth/signup", (req, res, next) => {
  void (async () => {
    const parsed = SignUpBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) });
      return;
    }

    const { email, password, displayName } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      // Signup necessarily reveals whether an email is taken — there is no way
      // to both refuse a duplicate and hide it. Login does not leak the same
      // fact (see below), so an attacker gains nothing they could not learn
      // here by simply trying to register the address.
      res.status(409).json({ error: "That email already has an account" });
      return;
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      res.status(400).json({ error: "Pick a display name" });
      return;
    }

    const user = await createUser({
      email,
      passwordHash: await hashPassword(password),
      displayName: trimmedName,
    });

    await startSession(res, user.id);
    logger.info({ userId: user.id }, "User signed up");
    res.status(201).json(toPublicUser(user));
  })().catch(next);
});

router.post("/auth/login", (req, res, next) => {
  void (async () => {
    const parsed = LogInBody.safeParse(req.body);
    if (!parsed.success) {
      // Deliberately the same message the wrong-password path returns, so a
      // malformed body cannot be used to probe anything either.
      res.status(401).json({ error: "Wrong email or password" });
      return;
    }

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);

    if (!user) {
      // Spend the same time as a real verification would, then give the same
      // answer. Skipping this would make "no such account" measurably faster
      // and turn login into an email-enumeration oracle.
      await fakeVerify();
      res.status(401).json({ error: "Wrong email or password" });
      return;
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Wrong email or password" });
      return;
    }

    await startSession(res, user.id);
    res.json(toPublicUser(user));
  })().catch(next);
});

router.post("/auth/logout", (req, res, next) => {
  void (async () => {
    // Idempotent on purpose: signing out when already signed out is a success,
    // not an error, so a stale tab cannot get stuck unable to clear itself.
    await endSession(req, res);
    res.status(204).end();
  })().catch(next);
});

router.get("/auth/me", (req, res) => {
  // Anonymous is a normal answer, not a 401 — everything readable in PatchWork
  // is readable without an account, and the client calls this on every load to
  // decide whether to show "Sign in" or a profile.
  res.json({ user: req.user ? toPublicUser(req.user) : null });
});

export default router;
