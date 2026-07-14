import { useState } from "react";
import type { Key } from "ink";

import type { Review } from "../../review/index.js";
import type { Composer, ComposerTarget } from "../types.js";
import { editValue } from "./helpers.js";

interface ComposerArgs {
  review: Review;
  onSubmitted: (notice: string) => Promise<void>;
  onError: (e: Error) => void;
}

export function useComposer({ review, onSubmitted, onError }: ComposerArgs) {
  const [composer, setComposer] = useState<Composer | null>(null);

  const open = (target: ComposerTarget) => setComposer({ ...target, value: "" });

  const submit = (c: Composer, body: string): Promise<unknown> | null => {
    if (c.mode === "reply" && c.threadId) {
      return review.continueThread(c.threadId, { body });
    }

    if (c.mode === "general") {
      return review.addGeneralComment({ body });
    }

    if (c.file && c.side && c.line != null) {
      return review.addComment({ file: c.file, side: c.side, line: c.line, body });
    }

    return null;
  };

  const handleKey = (ch: string, key: Key): boolean => {
    if (!composer) {
      return false;
    }

    if (key.return) {
      const body = composer.value.trim();
      const submitted = composer;

      setComposer(null);

      if (body) {
        submit(submitted, body)
          ?.then(() => onSubmitted(submitted.mode === "reply" ? "reply added" : "comment added"))
          .catch(onError);
      }

      return true;
    }

    if (key.escape) {
      setComposer(null);

      return true;
    }

    setComposer((p) => (p ? { ...p, value: editValue(p.value, ch, key) } : p));

    return true;
  };

  return { composer, open, handleKey };
}
