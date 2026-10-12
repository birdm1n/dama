export type ShareStatus = "draft" | "shared";

export type MemoryRow = {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  body: string;
  happened_on: string;
  tags: string[];
  share_status: ShareStatus;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Memory = MemoryRow & { authorName: string; isMine: boolean };
