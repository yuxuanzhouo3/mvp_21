"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayCircle, X } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DEFAULT_VIDEO_PATH = "/videos/home-demo.mp4";
const DEFAULT_POSTER_PATH = "/videos/home-demo-poster.svg";

export function DemoVideoButton() {
  const [open, setOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.demoVideo;
  const videoUrl =
    process.env.NEXT_PUBLIC_HOME_DEMO_VIDEO_URL?.trim() || DEFAULT_VIDEO_PATH;
  const posterUrl = DEFAULT_POSTER_PATH;

  useEffect(() => {
    if (open) {
      setPlaybackError(false);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = 0;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 rounded-xl border-border/70 bg-card px-0 shadow-sm hover:bg-accent md:w-auto md:px-4"
          aria-label={labels.button}
        >
          <PlayCircle className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">{labels.button}</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="w-[min(100%-1.5rem,64rem)] max-w-5xl gap-0 overflow-hidden border-border/60 p-0 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-left text-xl font-semibold">
                  {labels.title}
                </DialogTitle>
                <DialogDescription className="mt-1 text-left text-sm">
                  {labels.description}
                </DialogDescription>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label={labels.close}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-black shadow-sm">
            {playbackError ? (
              <div
                className={cn(
                  "flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center",
                  "bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_45%),linear-gradient(180deg,#111827_0%,#020617_100%)]",
                )}
              >
                <Image
                  src={posterUrl}
                  alt={labels.title}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-2xl border border-white/10 bg-white/5 p-3"
                />
                <div className="max-w-xl space-y-2">
                  <p className="text-lg font-semibold text-white">
                    {labels.fallbackTitle}
                  </p>
                  <p className="text-sm leading-6 text-white/75">
                    {labels.fallbackDescription}
                  </p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="aspect-video w-full bg-black"
                controls
                playsInline
                preload="metadata"
                poster={posterUrl}
                autoPlay={open}
                onError={() => setPlaybackError(true)}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
