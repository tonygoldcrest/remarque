import { useCallback, useEffect, useRef, useState } from "react";

import type { Review } from "../../review/index.js";
import type { FileEntry, StagingGroups } from "../model/index.js";
import { mergeOrder } from "../model/index.js";

interface StagingArgs {
  review: Review;
  available: boolean;
  onError: (e: Error) => void;
}

export function useStaging({ review, available, onError }: StagingArgs) {
  const [groups, setGroups] = useState<StagingGroups | null>(null);
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!available) {
      return setGroups(null);
    }

    const status = await review.stagingStatus();

    if (alive.current) {
      setGroups((prev) => ({
        staged: mergeOrder(prev?.staged ?? [], status.staged),
        unstaged: mergeOrder(prev?.unstaged ?? [], status.unstaged),
      }));
    }
  }, [review, available]);

  useEffect(() => {
    refresh().catch(onError);
  }, [refresh, onError]);

  const toggle = async (entry: FileEntry): Promise<string> => {
    if (!groups) {
      return "staging is only available when reviewing the working tree";
    }

    const paths = entry.oldFile ? [entry.oldFile, entry.file] : [entry.file];

    if (groups.unstaged.includes(entry.file)) {
      await review.stageFiles(paths);
      setGroups((prev) =>
        prev
          ? {
              staged: [...prev.staged.filter((f) => f !== entry.file), entry.file],
              unstaged: prev.unstaged.filter((f) => f !== entry.file),
            }
          : prev,
      );

      return `staged ${entry.file}`;
    }

    if (!groups.staged.includes(entry.file)) {
      return `no working changes in ${entry.file}`;
    }

    await review.unstageFiles(paths);
    setGroups((prev) =>
      prev
        ? {
            staged: prev.staged.filter((f) => f !== entry.file),
            unstaged: [entry.file, ...prev.unstaged.filter((f) => f !== entry.file)],
          }
        : prev,
    );

    return `unstaged ${entry.file}`;
  };

  return { groups, refresh, toggle };
}
