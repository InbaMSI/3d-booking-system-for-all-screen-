import { httpCinemaApi } from "./http-client";
import { mockCinemaApi } from "./mock-client";

const apiMode = process.env.NEXT_PUBLIC_API_MODE ?? (process.env.NODE_ENV === "development" ? "http" : "mock");

if (apiMode && apiMode !== "http" && apiMode !== "mock") {
  throw new Error(`Unsupported NEXT_PUBLIC_API_MODE "${apiMode}". Use "mock" or "http".`);
}

export const cinemaApi = apiMode === "http" ? httpCinemaApi : mockCinemaApi;
export const usingMockApi = apiMode === "mock";
