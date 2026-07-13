import type { CommentInput, GeneralCommentInput } from "../review";

export interface ReviewPayload {
  comments: CommentInput[];
  general: GeneralCommentInput[];
}
