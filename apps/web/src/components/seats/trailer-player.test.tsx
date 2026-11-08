import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrailerPlayer } from "./trailer-player";

describe("TrailerPlayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a sound-enabled user gesture before playback", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<TrailerPlayer onTextureChange={vi.fn()} src="https://media.example.test/authorized-trailer.mp4" />);
    const video = screen.getByLabelText("Movie trailer displayed on the auditorium screen") as HTMLVideoElement;
    expect(video.muted).toBe(false);
    expect(screen.getByText("Press Play with sound to start the trailer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play trailer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause trailer" })).toBeInTheDocument());
    expect(video.muted).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("uses a 0-10 volume control and exposes a mute toggle", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<TrailerPlayer onTextureChange={vi.fn()} src="https://media.example.test/authorized-trailer.mp4" />);
    const video = screen.getByLabelText("Movie trailer displayed on the auditorium screen") as HTMLVideoElement;
    const volume = screen.getByRole("slider", { name: "Trailer volume" });
    await waitFor(() => expect(video.muted).toBe(false));
    expect(volume).toHaveValue("10");
    fireEvent.change(volume, { target: { value: "6" } });
    expect(video.volume).toBeCloseTo(0.6);
    expect(screen.getByText("Volume 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mute trailer" }));
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Unmute trailer" }));
    expect(video.muted).toBe(false);
  });

  it("reports an unavailable trailer without creating a video element", () => {
    render(<TrailerPlayer onTextureChange={vi.fn()} src={null} />);
    expect(screen.getByText("No authorized trailer is configured for this film.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Movie trailer displayed on the auditorium screen")).not.toBeInTheDocument();
  });

  it("reports invalid trailer sources as a media error", () => {
    render(<TrailerPlayer onTextureChange={vi.fn()} src="not-a-valid-media-resource" />);
    fireEvent.error(screen.getByLabelText("Movie trailer displayed on the auditorium screen"));
    expect(screen.getByText("Trailer unavailable. Please try again later.")).toBeInTheDocument();
  });
});
