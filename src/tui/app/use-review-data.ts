import { useCallback, useEffect, useState } from "react";

import type { Review } from "../../review";
import type { ReviewState, StructuredDiff } from "../../protocol";
import { watchStore } from "../../store/watch";

export function useReviewData(review: Review, onError: (e: Error) => void) {
  const [structured, setStructured] = useState<StructuredDiff | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);

  const reloadAll = useCallback(async () => {
    setStructured(await review.diffFiles({ whole: true }));
    setState(await review.state());
  }, [review]);

  const reloadThreads = useCallback(async () => {
    setState(await review.state());
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
