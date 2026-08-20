import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// Hand-wrapped rather than promisify()'d: promisify resolves to scrypt's
// three-argument overload and drops the options parameter, which is where
// every cost parameter below lives.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Deliberately slow. These are the cost parameters an attacker has to pay for
// every guess against a stolen hash, so they are the whole point of using
// scrypt instead of a plain digest. 128 * N * r ≈ 16 MB of memory per hash.
const N = 16_384;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Encoded as scrypt$N$r$p$salt$hash so the cost parameters travel with the
// hash. Raising them later then only affects new passwords, and old ones keep
// verifying against the parameters they were created with.
const PREFIX = "scrypt";

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r,
    p,
    // Node's default maxmem (32 MB) sits close to what these parameters need;
    // asking for headroom avoids an intermittent ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
    maxmem: 64 * 1024 * 1024,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await derive(password, salt);
  return [PREFIX, N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts as [
    string, string, string, string, string, string,
  ];

  const storedN = Number(nRaw);
  const storedR = Number(rRaw);
  const storedP = Number(pRaw);
  if (!Number.isFinite(storedN) || !Number.isFinite(storedR) || !Number.isFinite(storedP)) {
    return false;
  }

  const salt = Buffer.from(saltRaw, "base64");
  const expected = Buffer.from(hashRaw, "base64");

  let actual: Buffer;
  try {
    actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: storedN,
      r: storedR,
      p: storedP,
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  // Lengths must match before timingSafeEqual, which throws on a mismatch.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Burn roughly the same time as a real verification.
 *
 * Called when login is given an email that has no account. Without it, "no
 * such user" would return noticeably faster than "wrong password", and that
 * difference alone tells an attacker which email addresses are registered.
 */
export async function fakeVerify(): Promise<void> {
  await derive("timing-equaliser", Buffer.alloc(SALT_LENGTH));
}
