import type { ReviewStore } from "../protocol.js";

export interface StorageBackend {
  read(): Promise<ReviewStore>;
  update(mutator: (store: ReviewStore) => ReviewStore | void): Promise<ReviewStore>;
  location(): string;
}
