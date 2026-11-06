import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrailerPlayer } from "./trailer-player";

describe("TrailerPlayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a play fallback when muted autoplay is rejected and allows explicit playback", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new Error("autoplay denied"))
      .mockResolvedValueOnce(undefined);
    render(<TrailerPlayer onTextureChange={vi.fn()} src="https://media.example.test/authorized-trailer.mp4" />);
    await waitFor(() => expect(screen.getByText("Press play to start the trailer")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Play trailer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play trailer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause trailer" })).toBeInTheDocument());
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("starts muted and exposes a user-controlled mute toggle", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<TrailerPlayer onTextureChange={vi.fn()} src="https://media.example.test/authorized-trailer.mp4" />);
    const video = screen.getByLabelText("Movie trailer displayed on the auditorium screen") as HTMLVideoElement;
    await waitFor(() => expect(video.muted).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Unmute trailer" }));
    expect(video.muted).toBe(false);
    expect(screen.getByRole("button", { name: "Mute trailer" })).toBeInTheDocument();
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
