import type { EditorialPost, PostPublication, PostStatus } from "./types";

const activePublicationStatuses: PostPublication["status"][] = ["scheduled", "pending", "processing"];

export function derivePostStatusFromPublications(
  postStatus: PostStatus,
  publications: Pick<PostPublication, "status">[]
): PostStatus {
  if (publications.some((publication) => publication.status === "published")) return "Publicado";
  if (publications.some((publication) => activePublicationStatuses.includes(publication.status))) {
    return "Agendado";
  }
  return postStatus;
}

export function publicationsForPost(
  postId: string,
  publications: PostPublication[]
): PostPublication[] {
  return publications.filter((publication) => publication.postId === postId);
}

export function derivedPostStatus(
  post: EditorialPost,
  publications: PostPublication[]
): PostStatus {
  return derivePostStatusFromPublications(post.status, publicationsForPost(post.id, publications));
}
