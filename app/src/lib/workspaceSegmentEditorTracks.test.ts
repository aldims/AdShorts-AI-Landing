import { describe, expect, it } from "vitest";

import {
  buildWorkspaceSegmentEditorTracks,
  type WorkspaceSegmentEditorTrackSegment,
} from "./workspaceSegmentEditorTracks";

const createSegment = (
  index: number,
  overrides: Partial<WorkspaceSegmentEditorTrackSegment> = {},
): WorkspaceSegmentEditorTrackSegment => ({
  duration: 2,
  endTime: 2,
  index,
  sceneSoundAsset: null,
  sceneSoundAssetId: null,
  speechDuration: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: `Сегмент ${index}`,
  voiceType: null,
  ...overrides,
});

describe("buildWorkspaceSegmentEditorTracks", () => {
  it("builds equal scene spans while preserving timeline start and end times", () => {
    const tracks = buildWorkspaceSegmentEditorTracks([
      createSegment(1, { endTime: 3, startTime: 0 }),
      createSegment(2, { endTime: 8, startTime: 3 }),
    ]);

    expect(tracks.totalDuration).toBe(8);
    expect(tracks.segmentSpans).toHaveLength(2);
    expect(tracks.segmentSpans[0]).toMatchObject({
      duration: 3,
      endTime: 3,
      leftRatio: 0,
      startTime: 0,
      widthRatio: 1 / 2,
    });
    expect(tracks.segmentSpans[1]).toMatchObject({
      duration: 5,
      endTime: 8,
      leftRatio: 1 / 2,
      startTime: 3,
      widthRatio: 1 / 2,
    });
  });

  it("keeps visual, voice, sound, and text scene columns aligned after uneven durations", () => {
    const tracks = buildWorkspaceSegmentEditorTracks([
      createSegment(1, { endTime: 5, startTime: 0 }),
      createSegment(2, { endTime: 14, startTime: 5 }),
      createSegment(3, { endTime: 16, startTime: 14 }),
      createSegment(4, { endTime: 31, startTime: 16 }),
    ]);
    const sceneRows = tracks.rows.filter((row) => row.kind !== "music");

    expect(sceneRows).toHaveLength(4);
    sceneRows.forEach((row) => {
      expect(row.spans.map((span) => span.leftRatio)).toEqual([0, 0.25, 0.5, 0.75]);
      expect(row.spans.map((span) => span.widthRatio)).toEqual([0.25, 0.25, 0.25, 0.25]);
    });
    expect(tracks.rows.find((row) => row.kind === "music")?.spans[0]).toMatchObject({
      leftRatio: 0,
      widthRatio: 1,
    });
  });

  it("marks visual, voice, sound, text, and music changes", () => {
    const baseline = [
      createSegment(1, { sceneSoundAssetId: null, text: "Исходный текст", voiceType: null }),
      createSegment(2, { sceneSoundAssetId: 10, text: "Без изменений", voiceType: null }),
    ];
    const draft = [
      createSegment(1, {
        sceneSoundAssetId: 55,
        text: "Новый текст",
        voiceType: "voice-a",
      }),
      createSegment(2, {
        sceneSoundAssetId: 10,
        text: "Без изменений",
        voiceType: null,
      }),
    ];

    const tracks = buildWorkspaceSegmentEditorTracks(
      draft,
      baseline,
      { customMusicAssetId: 441, customMusicFileName: "new-track.mp3", musicType: "custom" },
      { customMusicAssetId: null, customMusicFileName: null, musicType: "ai" },
      {
        isSoundEdited: (segment, baselineSegment) => segment.sceneSoundAssetId !== baselineSegment?.sceneSoundAssetId,
        isTextEdited: (segment, baselineSegment) => segment.text !== baselineSegment?.text,
        isVisualEdited: (segment) => segment.index === 2,
        isVoiceEdited: (segment, baselineSegment) => segment.voiceType !== baselineSegment?.voiceType,
      },
    );

    const visualRow = tracks.rows.find((row) => row.kind === "visual");
    const musicRow = tracks.rows.find((row) => row.kind === "music");
    const voiceRow = tracks.rows.find((row) => row.kind === "voice");
    const soundRow = tracks.rows.find((row) => row.kind === "sound");
    const textRow = tracks.rows.find((row) => row.kind === "text");

    expect(visualRow?.spans[1]?.isEdited).toBe(true);
    expect(musicRow?.spans[0]?.isEdited).toBe(true);
    expect(voiceRow?.spans[0]?.isEdited).toBe(true);
    expect(soundRow?.spans[0]?.isEdited).toBe(true);
    expect(soundRow?.spans[1]?.isEmpty).toBe(false);
    expect(textRow?.spans[0]?.isEdited).toBe(true);
    expect(textRow?.spans[1]?.isEdited).toBe(false);
  });

  it("keeps active array index stable after reordering by consuming current array order", () => {
    const tracks = buildWorkspaceSegmentEditorTracks(
      [
        createSegment(3, { endTime: 2, startTime: 0 }),
        createSegment(1, { endTime: 5, startTime: 2 }),
        createSegment(2, { endTime: 7, startTime: 5 }),
      ],
      [],
      null,
      null,
      { activeArrayIndex: 1 },
    );

    expect(tracks.segmentSpans.map((span) => span.segmentIndex)).toEqual([3, 1, 2]);
    expect(tracks.segmentSpans.map((span) => span.isActive)).toEqual([false, true, false]);
  });

  it("marks music changed when the resolved project music asset changes", () => {
    const tracks = buildWorkspaceSegmentEditorTracks(
      [createSegment(1)],
      [createSegment(1)],
      { musicAssetId: 12, musicName: "new.mp3", musicType: "upbeat" },
      { musicAssetId: 11, musicName: "old.mp3", musicType: "upbeat" },
    );

    expect(tracks.rows.find((row) => row.kind === "music")?.spans[0]?.isEdited).toBe(true);
  });
});
