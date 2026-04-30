export type TaskType = "simple" | "counter" | "content_daily";
export type TaskStatus = "open" | "done" | "cancelled";
export type TaskChannel =
  | "whatsapp"
  | "instagram"
  | "blog"
  | "meeting"
  | "video"
  | "other";

export interface Task {
  id: string;
  owner_id: string;
  title: string;
  type: TaskType;
  target_count: number | null;
  done_count: number;
  channel: TaskChannel | null;
  status: TaskStatus;
  due_date: string | null;
  related_quote_id: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ContentChannel = "whatsapp" | "instagram" | "blog";

export interface ContentLog {
  id: string;
  owner_id: string;
  channel: ContentChannel;
  posted_at: string;
  content_type: string | null;
  title_or_excerpt: string | null;
  url: string | null;
  notes: string | null;
}

export interface Meeting {
  id: string;
  owner_id: string;
  title: string;
  meeting_date: string;
  attendees: string | null;
  summary: string | null;
  action_items: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

export type Currency = "ILS" | "USD";

export interface ManualIncome {
  id: string;
  owner_id: string;
  customer_name: string;
  amount: number;
  currency: Currency;
  paid_at: string;
  description: string | null;
  created_at: string;
}

export type ExpenseCategory = "מסים" | "אחר";

export interface ManualExpenseOther {
  id: string;
  owner_id: string;
  amount: number;
  currency: Currency;
  expense_date: string;
  category: ExpenseCategory;
  vendor: string | null;
  description: string | null;
  attachment_path: string | null;
  created_at: string;
}

// Phase B — declared early for type safety
export type QuoteStatus =
  | "needs_detail"
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

export interface Quote {
  id: string;
  owner_id: string;
  dinaroz_doc_number: string;
  customer_name: string | null;
  amount: number | null;
  currency: Currency;
  sent_at: string;
  status: QuoteStatus;
  source: "email" | "manual";
  gmail_message_id: string | null;
  raw_subject: string | null;
  notes: string | null;
  created_at: string;
}

// Tools expense mirror (read-only from existing tracker public JSON)
export interface ToolsExpenseSnapshot {
  generated: string;
  built_at: string;
  usd_rate: number;
  grand_total: number;
  grand_total_ils: number;
  monthly?: Array<{
    month: string;
    total_ils: number;
    total_usd: number;
    transactions: Array<{
      date: string;
      tool: string;
      amount_ils: number;
      amount_usd: number;
    }>;
  }>;
  vendors?: Array<{
    tool: string;
    total_ils: number;
    total_usd: number;
    last_charge?: string;
  }>;
}
