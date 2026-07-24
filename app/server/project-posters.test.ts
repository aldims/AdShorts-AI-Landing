import { describe, expect, it } from "vitest";

import { buildWorkspacePosterCaptureInputArgs } from "./project-posters.js";

describe("workspace project poster capture", () => {
  it("seeks after opening HTTP inputs so partial range responses remain decodable", () => {
    const args = buildWorkspacePosterCaptureInputArgs(
      {
        upstreamHeaders: {
          "X-Admin-Token": "secret",
        },
        upstreamUrl: new URL("https://media.example.test/api/projects/4308/segments/0/video"),
      },
      1.5,
    );

    expect(args.indexOf("-headers")).toBeLessThan(args.indexOf("-i"));
    expect(args.indexOf("-i")).toBeLessThan(args.indexOf("-ss"));
    expect(args).toEqual([
      "-headers",
      "X-Admin-Token: secret\r\n",
      "-i",
      "https://media.example.test/api/projects/4308/segments/0/video",
      "-ss",
      "1.5",
    ]);
  });

  it("keeps fast input seeking for local files", () => {
    const args = buildWorkspacePosterCaptureInputArgs(
      {
        upstreamUrl: new URL("file:///tmp/segment.mp4"),
      },
      0.75,
    );

    expect(args).toEqual(["-ss", "0.75", "-i", "/tmp/segment.mp4"]);
  });

  it("omits a zero-time seek", () => {
    const args = buildWorkspacePosterCaptureInputArgs(
      {
        upstreamUrl: new URL("https://media.example.test/video.mp4"),
      },
      0,
    );

    expect(args).toEqual(["-i", "https://media.example.test/video.mp4"]);
  });
});
