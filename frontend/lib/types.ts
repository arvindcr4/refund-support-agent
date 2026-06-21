export type Role = "user" | "assistant";

export interface ChatTurn {
  role: Role;
  content: string;
}

export interface OrderSummary {
  id: string;
  item: string;
  amount: number;
  status: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  tier: string;
  fraud_flag: boolean;
  lifetime_refunds: number;
  orders: OrderSummary[];
}

export interface OrderFull {
  id: string;
  item: string;
  category: string;
  amount: number;
  status: string;
  delivery_date: string | null;
  condition: string;
  final_sale: boolean;
  already_refunded: boolean;
  customer_note?: string;
}

export interface CustomerFull {
  id: string;
  name: string;
  email: string;
  tier: string;
  fraud_flag: boolean;
  lifetime_refunds: number;
  orders: OrderFull[];
}

export type ActionKind = "refund_issued" | "refund_denied" | "escalated";

export interface ActionLogEntry {
  action: ActionKind;
  order_id: string;
  customer_id: string;
  amount?: number;
  reason?: string;
}

export interface StateResponse {
  customers: CustomerFull[];
  action_log: ActionLogEntry[];
}

// SSE event shapes from POST /api/chat

export interface ToolCallEvent {
  kind: "tool_call";
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  kind: "tool_result";
  tool: string;
  output: string;
}

export interface FinalEvent {
  kind: "final";
  content: string;
}

export interface ErrorEvent {
  kind: "error";
  message: string;
}

export interface DoneEvent {
  kind: "done";
}

export type StreamEvent =
  | ToolCallEvent
  | ToolResultEvent
  | FinalEvent
  | ErrorEvent
  | DoneEvent;

// Reasoning-timeline item.
export interface TimelineItem {
  id: string;
  type: "tool_call" | "tool_result" | "final" | "error";
  tool?: string;
  args?: Record<string, unknown>;
  output?: string;
  content?: string;
  message?: string;
  ts: number;
}
