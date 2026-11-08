"use client";

import { useEffect, useRef, useState } from "react";
import { SRGBColorSpace, VideoTexture } from "three";

interface TrailerPlayerProps {
  src: string | null;
  onTextureChange: (texture: VideoTexture | null, aspectRatio: number | null) => void;
}

export function TrailerPlayer({ src, onTextureChange }: TrailerPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textureRef = useRef<VideoTexture | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(10);
  const [playback, setPlayback] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(true);
  const [mediaErrorSrc, setMediaErrorSrc] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
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
    video.muted = false;
    video.volume = 1;
    setAutoplayBlocked(true);
    video.load();

    return () => {
      video.pause();
      texture.dispose();
      textureRef.current = null;
      onTextureChange(null, null);
    };
  }, [src, onTextureChange]);

  return (
    <div className="trailer-controls">
      {src ? (
        <video
          aria-label="Movie trailer displayed on the auditorium screen"
          className="trailer-video"
          loop
          muted={muted}
          onLoadedData={(event) => {
            const element = event.currentTarget;
            const texture = textureRef.current;
            if (texture && element.videoWidth > 0 && element.videoHeight > 0) {
              onTextureChange(texture, element.videoWidth / element.videoHeight);
            }
          }}
          onCanPlay={() => setBuffering(false)}
          onLoadedMetadata={() => setBuffering(false)}
          onDurationChange={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setPlayback((event.currentTarget.currentTime / duration) * 100);
          }}
          onError={() => {
            if (src) setMediaErrorSrc(src);
            setIsPlaying(false);
          }}
          onProgress={() => setBuffering(false)}
          onPlaying={() => {
            setBuffering(false);
            setIsPlaying(true);
            setAutoplayBlocked(false);
          }}
          onPause={() => setIsPlaying(false)}
          onStalled={() => videoRef.current && !videoRef.current.paused && setBuffering(true)}
          onTimeUpdate={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setPlayback((event.currentTarget.currentTime / duration) * 100);
          }}
          onWaiting={() => setBuffering(true)}
          playsInline
          preload="auto"
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
            className={`icon-control play-control ${autoplayBlocked ? "needs-play" : ""}`}
            disabled={mediaError}
            onClick={() => {
              const element = videoRef.current;
              if (!element) return;
              if (element.paused) {
                element.muted = volumeLevel === 0;
                element.volume = volumeLevel / 10;
                setMuted(volumeLevel === 0);
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
            {autoplayBlocked ? "Play with sound  ▶" : isPlaying ? "Ⅱ" : "▶"}
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
          <label className="volume-control">
            <span>Volume {volumeLevel}</span>
            <input
              aria-label="Trailer volume"
              max="10"
              min="0"
              onChange={(event) => {
                const nextLevel = Number(event.currentTarget.value);
                setVolumeLevel(nextLevel);
                if (videoRef.current) {
                  videoRef.current.volume = nextLevel / 10;
                  const shouldMute = nextLevel === 0;
                  setMuted(shouldMute);
                  videoRef.current.muted = shouldMute;
                }
              }}
              type="range"
              value={volumeLevel}
            />
          </label>
          <button
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="icon-control mute-control"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              if (videoRef.current) {
                videoRef.current.muted = nextMuted;
                if (!nextMuted && volumeLevel === 0) {
                  setVolumeLevel(10);
                  videoRef.current.volume = 1;
                }
              }
            }}
            type="button"
          >
            {muted ? "MUTE" : "SOUND ON"}
          </button>
          <span aria-live="polite" className="trailer-status">
            {buffering ? "Buffering…" : autoplayBlocked ? "Press Play with sound to start the trailer" : "Trailer playing with sound"}
          </span>
        </>
      )}
    </div>
  );
}
