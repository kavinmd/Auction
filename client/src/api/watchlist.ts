/**
 * Watchlist API — add, remove, and fetch the authenticated user's watchlist.
 */

import axiosInstance from "./axiosInstance";
import type { Auction } from "../types";

export interface WatchlistToggleResponse {
  user_id: string;
  auction_id: string;
  already_exists: boolean;
}

/**
 * Add an auction to the current user's watchlist.
 * Returns 200 whether the entry was newly created or already existed.
 */
export async function addToWatchlist(
  auctionId: string
): Promise<WatchlistToggleResponse> {
  const res = await axiosInstance.post<WatchlistToggleResponse>(
    `/api/watchlist/${auctionId}`
  );
  return res.data;
}

/**
 * Remove an auction from the current user's watchlist.
 * Idempotent — silently succeeds if not on watchlist.
 */
export async function removeFromWatchlist(auctionId: string): Promise<void> {
  await axiosInstance.delete(`/api/watchlist/${auctionId}`);
}

/**
 * Fetch all auctions on the current user's watchlist.
 */
export async function getMyWatchlist(): Promise<Auction[]> {
  const res = await axiosInstance.get<Auction[]>("/api/users/me/watchlist");
  return res.data;
}
