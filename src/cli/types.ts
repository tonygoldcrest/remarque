import type { CommentInput, GeneralCommentInput } from "../review/index.js";

export interface ReviewPayload {
  comments: CommentInput[];
  general: GeneralCommentInput[];
}
