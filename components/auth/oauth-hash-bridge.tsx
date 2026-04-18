"use client";

import { useEffect } from "react";

export function OAuthHashBridge() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash || "";
    if (!hash.includes("access_token=") && !hash.includes("error=")) {
      return;
    }

    const target = `/auth/callback${hash}`;
    window.location.replace(target);
  }, []);

  return null;
}

