import { useState } from "react";

import type { Review } from "../../review/index.js";
import type { DeleteRequest } from "../types.js";

interface ConfirmDeleteArgs {
  review: Review;
  onDeleted: () => Promise<void>;
  onError: (e: Error) => void;
}

export function useConfirmDelete({ review, onDeleted, onError }: ConfirmDeleteArgs) {
  const [request, setRequest] = useState<DeleteRequest | null>(null);

  const requestDelete = (threadId: string) =>
    setRequest({ threadId, label: "delete this comment?" });

  const handleKey = (ch: string): boolean => {
    if (!request) {
      return false;
    }

    const { threadId } = request;

    setRequest(null);

    if (ch === "y" || ch === "Y") {
      review.deleteThread(threadId).then(onDeleted).catch(onError);
    }

    return true;
  };

  return { request, requestDelete, handleKey };
}
