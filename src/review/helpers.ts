import { randomUUID } from "node:crypto";

import type { Author, Message, ReviewStore } from "../protocol";
import type { ReviewItem } from "./types";

export function now(): string {
  return new Date().toISOString();
}

export function newMessage(author: Author, body: string): Message {
  return { id: randomUUID(), author, body, at: now() };
}

export function findById(store: ReviewStore, id: string): ReviewItem | undefined {
  return (
    store.threads.find((t) => t.id === id || t.id.startsWith(id)) ??
    store.generalComments.find((g) => g.id === id || g.id.startsWith(id))
  );
}
