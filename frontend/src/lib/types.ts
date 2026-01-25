export type ItemStatus = 'queued' | 'processing' | 'succeeded' | 'needs_user_text' | 'failed';

export type ItemInputType = "url" | "text";

export interface Item {
  id: string;
  status: ItemStatus;
  input_type: ItemInputType;
  input_url?: string;
  title?: string | null;
  source?: string; // source of the item (e.g. "linkedin", "reddit", "substack", "twitter", "email", "other")
  created_at: string;
  updated_at: string;
  error_code?: string;
  error_detail?: string;
}

export interface ItemContent {
  canonical_text: string; // required when status is 'succeeded', the canonical text of the item
  extracted_text?: string;
  user_pasted_text?: string;
}

export interface ItemDetailResponse {
  item: Item;
  content?: ItemContent | null;
}