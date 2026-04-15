// ===============================
// src/progress/app/useGanttUiSettings.ts
// ===============================
import { useEffect, useMemo, useState } from "react";
import { PROGRESS_KEYS } from "../../storage/progressLocalKeys";
import {
  lsReadBool,
  lsReadNumber,
  lsReadString,
  lsWriteBool,
  lsWriteNumber,
  lsWriteString,
} from "../../storage/localSettings";

const ZOOM_LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 56] as const;
type ZoomIdx = number;

type Result = {
  ganttZoomLevels: readonly number[];
  ganttZoomIdx: ZoomIdx;
  setGanttZoomIdx: React.Dispatch<React.SetStateAction<ZoomIdx>>;
  ganttPxPerDay: number;

  ganttWeekendShade: boolean;
  setGanttWeekendShade: React.Dispatch<React.SetStateAction<boolean>>;

  ganttTodayLine: boolean;
  setGanttTodayLine: React.Dispatch<React.SetStateAction<boolean>>;

  ganttShowBarText: boolean;
  setGanttShowBarText: React.Dispatch<React.SetStateAction<boolean>>;

  ganttDefaultBarColor: string;
  setGanttDefaultBarColor: React.Dispatch<React.SetStateAction<string>>;
};

export function useGanttUiSettings(): Result {
  const ganttZoomLevels = ZOOM_LEVELS;

  const [ganttZoomIdx, setGanttZoomIdx] = useState<ZoomIdx>(() => {
    const idx = lsReadNumber(PROGRESS_KEYS.ganttZoomIdx, 12, {
      min: 0,
      max: ganttZoomLevels.length - 1,
    });
    return Math.floor(idx);
  });

  const [ganttWeekendShade, setGanttWeekendShade] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttWeekendShade, true);
  });

  const [ganttTodayLine, setGanttTodayLine] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttTodayLine, true);
  });

  const [ganttShowBarText, setGanttShowBarText] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttShowBarText, true);
  });

  const [ganttDefaultBarColor, setGanttDefaultBarColor] = useState<string>(() => {
    return (
      lsReadString(PROGRESS_KEYS.ganttDefaultBarColor, "#b98a3a") || "#b98a3a"
    );
  });

  useEffect(() => {
    lsWriteNumber(PROGRESS_KEYS.ganttZoomIdx, ganttZoomIdx);
  }, [ganttZoomIdx]);

  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttWeekendShade, ganttWeekendShade);
  }, [ganttWeekendShade]);

  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttTodayLine, ganttTodayLine);
  }, [ganttTodayLine]);

  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttShowBarText, ganttShowBarText);
  }, [ganttShowBarText]);

  useEffect(() => {
    lsWriteString(PROGRESS_KEYS.ganttDefaultBarColor, ganttDefaultBarColor);
  }, [ganttDefaultBarColor]);

  const ganttPxPerDay = useMemo(() => {
    return (ganttZoomLevels[ganttZoomIdx] ?? 24) as number;
  }, [ganttZoomIdx, ganttZoomLevels]);

  return {
    ganttZoomLevels: ganttZoomLevels as unknown as readonly number[],
    ganttZoomIdx,
    setGanttZoomIdx,
    ganttPxPerDay,

    ganttWeekendShade,
    setGanttWeekendShade,

    ganttTodayLine,
    setGanttTodayLine,

    ganttShowBarText,
    setGanttShowBarText,

    ganttDefaultBarColor,
    setGanttDefaultBarColor,
  };
}
