// TypeScript interfaces for AuctionSphere
// This file will grow as we add more features

export type AuctionStatus = "open" | "closed" | "paid" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed";

export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Auction {
  id: string;
  seller_id: string;
  seller?: User;
  title: string;
  description: string;
  category: string;
  image_urls: string[];
  starting_price: number;
  current_price: number;
  end_time: string;
  status: AuctionStatus;
  created_at: string;
  bid_count?: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder?: User;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  auction_id: string;
  winner_id: string;
  stripe_payment_id?: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// WebSocket message types
export type WsMessage =
  | { type: "new_bid"; bidder_name: string; amount: number; current_price: number; end_time: string }
  | { type: "auction_closed"; winner_id: string | null; final_price: number }
  | { type: "time_extended"; new_end_time: string };

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Auth
export interface AuthTokens {
  access_token: string;
  token_type: string;
}
