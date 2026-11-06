"use client";

import { useEffect, useRef, useState } from "react";
import { SRGBColorSpace, VideoTexture } from "three";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

interface TrailerPlayerProps {
  src: string | null;
  onTextureChange: (texture: VideoTexture | null, aspectRatio: number | null) => void;
}

export function TrailerPlayer({ src, onTextureChange }: TrailerPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textureRef = useRef<VideoTexture | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playback, setPlayback] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [mediaErrorSrc, setMediaErrorSrc] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const reducedMotion = useReducedMotion();
  const mediaError = src !== null && mediaErrorSrc === src;

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      onTextureChange(null, null);
      return;
    }

    const texture = new VideoTexture(video);
    textureRef.current = texture;
    texture.colorSpace = SRGBColorSpace;
    onTextureChange(null, null);
    if (!reducedMotion) {
      void video.play().then(
        () => setIsPlaying(true),
        () => {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        },
      );
    }

    return () => {
      video.pause();
      texture.dispose();
      video.removeAttribute("src");
      video.load();
      textureRef.current = null;
      onTextureChange(null, null);
    };
  }, [src, onTextureChange, reducedMotion]);

  return (
    <div className="trailer-controls">
      {src ? (
        <video
          aria-label="Movie trailer displayed on the auditorium screen"
          className="trailer-video"
          crossOrigin="anonymous"
          loop
          muted
          onLoadedData={(event) => {
            const element = event.currentTarget;
            const texture = textureRef.current;
            if (texture && element.videoWidth > 0 && element.videoHeight > 0) {
              onTextureChange(texture, element.videoWidth / element.videoHeight);
            }
          }}
          onCanPlay={() => setBuffering(false)}
          onDurationChange={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setPlayback((event.currentTarget.currentTime / duration) * 100);
          }}
          onError={() => {
            if (src) setMediaErrorSrc(src);
            setIsPlaying(false);
          }}
          onProgress={() => setBuffering(false)}
          onTimeUpdate={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setPlayback((event.currentTarget.currentTime / duration) * 100);
          }}
          onWaiting={() => setBuffering(true)}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={src}
        />
      ) : null}
      {!src || mediaError ? (
        <p aria-live="polite" className="trailer-status">
          {mediaError ? "Trailer unavailable. Please try again later." : "No authorized trailer is configured for this film."}
        </p>
      ) : (
        <>
          <button
            aria-label={isPlaying ? "Pause trailer" : "Play trailer"}
            className={`icon-control play-control ${autoplayBlocked || reducedMotion ? "needs-play" : ""}`}
            disabled={mediaError}
            onClick={() => {
              const element = videoRef.current;
              if (!element) return;
              if (element.paused) {
                void element.play().then(
                  () => {
                    setIsPlaying(true);
                    setAutoplayBlocked(false);
                  },
                  () => {
                    setIsPlaying(false);
                    setAutoplayBlocked(true);
                  },
                );
              } else {
                element.pause();
                setIsPlaying(false);
              }
            }}
            type="button"
          >
            {autoplayBlocked || reducedMotion ? "Play trailer  ▶" : isPlaying ? "Ⅱ" : "▶"}
          </button>
          <label className="playback-progress">
            <span className="sr-only">Trailer progress</span>
            <input
              aria-label="Trailer progress"
              max="100"
              min="0"
              onChange={(event) => {
                if (!videoRef.current || !Number.isFinite(videoRef.current.duration)) return;
                const progress = Number(event.currentTarget.value);
                videoRef.current.currentTime = (progress / 100) * videoRef.current.duration;
                setPlayback(progress);
              }}
              type="range"
              value={playback}
            />
          </label>
          <button
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="icon-control mute-control"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              if (videoRef.current) videoRef.current.muted = nextMuted;
            }}
            type="button"
          >
            {muted ? "MUTE" : "SOUND ON"}
          </button>
          <span aria-live="polite" className="trailer-status">
            {buffering ? "Buffering…" : autoplayBlocked || reducedMotion ? "Press play to start the trailer" : "Trailer"}
          </span>
        </>
      )}
    </div>
  );
}
