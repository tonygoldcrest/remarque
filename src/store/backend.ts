import type { ReviewStore } from "../protocol";

export interface StorageBackend {
  read(): Promise<ReviewStore>;
  update(mutator: (store: ReviewStore) => ReviewStore | void): Promise<ReviewStore>;
  location(): string;
}
