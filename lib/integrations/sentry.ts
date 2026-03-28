let initialized = false;

export function initSentry() {
  if (initialized) return;
  initialized = true;
}

export function captureException(err: unknown) {
  if (!initialized) {
    initSentry();
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[Sentry noop] captured exception:", err);
  }
}
