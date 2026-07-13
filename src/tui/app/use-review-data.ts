import { useCallback, useEffect, useRef, useState } from "react";

import type { Review } from "../../review";
import type { ReviewState, StructuredDiff } from "../../protocol";
import { watchStore } from "../../store/watch";

export function useReviewData(review: Review, onError: (e: Error) => void) {
  const [structured, setStructured] = useState<StructuredDiff | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const reloadAll = useCallback(async () => {
    const diff = await review.diffFiles({ whole: true });
    const nextState = await review.state();

    if (alive.current) {
      setStructured(diff);
      setState(nextState);
    }
  }, [review]);

  const reloadThreads = useCallback(async () => {
    const nextState = await review.state();

    if (alive.current) {
      setState(nextState);
    }
  }, [review]);

  useEffect(() => {
    reloadAll().catch(onError);
  }, [reloadAll, onError]);

  useEffect(() => {
    const watcher = watchStore(review.location(), 60, () => {
      reloadThreads().catch(() => undefined);
    });

    return () => watcher.close();
  }, [review, reloadThreads]);

  return { structured, state, reloadAll, reloadThreads };
}
