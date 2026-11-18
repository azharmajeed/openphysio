import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { db } from "../db";
import { checkInDates } from "../lib/adaptdb";
import { ymd } from "../lib/plan";
import { loadPlay, type Play } from "./playdb";

/** Streak, this week and today's points; refreshed on screen focus. null until the first load. */
export function usePlay(): Play | null {
  const [play, setPlay] = useState<Play | null>(null);
  useFocusEffect(
    useCallback(() => {
      void loadPlay(db, ymd(new Date()), checkInDates()).then(setPlay);
    }, []),
  );
  return play;
}
