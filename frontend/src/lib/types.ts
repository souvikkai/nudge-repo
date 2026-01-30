export type ItemStatus = 'queued' | 'processing' | 'succeeded' | 'needs_user_text' | 'failed';

export type SourceType = "url" | "pasted_text";

export interface ItemListEntry {
  id: string;
  status: ItemStatus;
  status_detail: string | null;
  source_type: SourceType;
  requested_url: string | null;
  final_text_source: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemContent {
  canonical_text?: string | null;
  extracted_text?: string;
  user_pasted_text?: string;
}

export type ItemCreateResponse = {
  id: string;
  status: ItemStatus;
};

export type ItemListResponse = {
  items: ItemListEntry[];
  next_cursor?: string | null;
};

export type ItemDetailResponse = ItemListEntry & {
  content?: ItemContent | null;
};
