"use client";

// Player unico per file locale (riprodotto nel browser, mai caricato), link a file video e YouTube.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface PlayerHandle {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(sec: number): void;
  step(sec: number): void;
  getTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  setRate(rate: number): void;
}

export type PlayerSource = { kind: "file"; url: string } | { kind: "url"; url: string } | { kind: "youtube"; id: string };

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT as YTNamespace);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

interface Props {
  source: PlayerSource;
  onDuration?: (sec: number) => void;
  onError?: (message: string) => void;
}

export const Player = forwardRef<PlayerHandle, Props>(function Player({ source, onDuration, onError }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const durationCb = useRef(onDuration);
  durationCb.current = onDuration;

  useEffect(() => {
    if (source.kind !== "youtube" || !ytHost.current) return;
    let cancelled = false;
    const host = document.createElement("div");
    ytHost.current.appendChild(host);
    loadYouTube().then((YT) => {
      if (cancelled) return;
      yt.current = new YT.Player(host, {
        videoId: source.id,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 1 },
        events: {
          onReady: () => {
            setYtReady(true);
            const d = yt.current?.getDuration() ?? 0;
            if (d > 0) durationCb.current?.(d);
          },
          onError: () => onError?.("YouTube non permette di riprodurre questo video qui. Usa il file originale."),
        },
      });
    });
    return () => {
      cancelled = true;
      yt.current?.destroy();
      yt.current = null;
      setYtReady(false);
      host.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind, source.kind === "youtube" ? source.id : null]);

  useImperativeHandle(
    ref,
    (): PlayerHandle => {
      const v = () => videoRef.current;
      const y = () => (ytReady ? yt.current : null);
      return {
        play: () => (v() ? void v()!.play().catch(() => {}) : y()?.playVideo()),
        pause: () => (v() ? v()!.pause() : y()?.pauseVideo()),
        toggle() {
          if (this.isPlaying()) this.pause();
          else this.play();
        },
        seek: (sec) => {
          const s = Math.max(0, sec);
          if (v()) v()!.currentTime = s;
          else y()?.seekTo(s, true);
        },
        step(sec) {
          this.pause();
          this.seek(this.getTime() + sec);
        },
        getTime: () => (v() ? v()!.currentTime : (y()?.getCurrentTime() ?? 0)),
        getDuration: () => (v() ? v()!.duration || 0 : (y()?.getDuration() ?? 0)),
        isPlaying: () => (v() ? !v()!.paused && !v()!.ended : y()?.getPlayerState() === 1),
        setRate: (rate) => {
          if (v()) v()!.playbackRate = rate;
          else y()?.setPlaybackRate(rate);
        },
      };
    },
    [ytReady],
  );

  if (source.kind === "youtube") return <div ref={ytHost} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />;
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      src={source.url}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => durationCb.current?.(e.currentTarget.duration)}
      onError={() => onError?.("Il browser non riesce a riprodurre questo video. Prova un file MP4 (H.264).")}
    />
  );
});
