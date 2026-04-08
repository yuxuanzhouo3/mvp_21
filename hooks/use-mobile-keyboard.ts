"use client";

import { useCallback, useEffect, useMemo, useState, type FocusEvent } from "react";

function getKeyboardInset() {
  if (typeof window === "undefined" || !window.visualViewport) {
    return 0;
  }

  const viewport = window.visualViewport;
  const rawInset = window.innerHeight - (viewport.height + viewport.offsetTop);
  return rawInset > 0 ? Math.round(rawInset) : 0;
}

function isSmallTouchScreen() {
  if (typeof window === "undefined") {
    return false;
  }

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  return isCoarsePointer && window.innerWidth <= 430;
}

export function useMobileKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;
    const updateInset = () => {
      if (!isSmallTouchScreen()) {
        setKeyboardInset(0);
        return;
      }
      setKeyboardInset(getKeyboardInset());
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);
    window.addEventListener("orientationchange", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
      window.removeEventListener("orientationchange", updateInset);
    };
  }, []);

  return keyboardInset;
}

export function useFocusScrollIntoView() {
  const enabled = useMemo(() => isSmallTouchScreen(), []);

  return useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!enabled) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const isEditableElement =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      if (!isEditableElement) {
        return;
      }

      window.setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }, 140);
    },
    [enabled],
  );
}
