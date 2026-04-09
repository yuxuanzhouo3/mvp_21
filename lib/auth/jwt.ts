import * as jwt from "jsonwebtoken";

const DEVELOPMENT_JWT_SECRET = "development-only-jwt-secret";

let warnedAboutDevelopmentSecret = false;

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function isNextProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function ensureJwtSecretConfigured(context = "authentication"): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  // During `next build`, runtime-only secrets might not be injected yet.
  // Keep build unblocked and enforce strict secret checks when serving traffic.
  if (isNextProductionBuildPhase()) {
    return DEVELOPMENT_JWT_SECRET;
  }

  if (isProductionEnvironment()) {
    throw new Error(`JWT_SECRET is required in production for ${context}.`);
  }

  if (!warnedAboutDevelopmentSecret) {
    warnedAboutDevelopmentSecret = true;
    console.warn(
      `[JWT] JWT_SECRET is not configured, using an in-memory development secret for ${context}.`,
    );
  }

  return DEVELOPMENT_JWT_SECRET;
}

export function assertProductionJwtConfiguration(): void {
  ensureJwtSecretConfigured("application startup");
}

export function getJoseJwtSecret(): Uint8Array {
  return new TextEncoder().encode(ensureJwtSecretConfigured("JOSE signing"));
}

export function signJwt(
  payload: string | Buffer | object,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(
    payload as jwt.JwtPayload,
    ensureJwtSecretConfigured("JWT signing"),
    options,
  );
}

export function verifyJwt<T = jwt.JwtPayload | string>(
  token: string,
): T {
  return jwt.verify(
    token,
    ensureJwtSecretConfigured("JWT verification"),
  ) as T;
}
