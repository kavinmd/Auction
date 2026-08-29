import axiosInstance from "./axiosInstance";
import type { Bid } from "../types";

/**
 * Place a new bid on an auction.
 */
export async function placeBid(auctionId: string, amount: number): Promise<Bid> {
  const response = await axiosInstance.post<Bid>(`/api/auctions/${auctionId}/bids`, {
    amount,
  });
  return response.data;
}

/**
 * Fetch all bids placed on a specific auction.
 */
export async function getAuctionBids(auctionId: string): Promise<Bid[]> {
  const response = await axiosInstance.get<Bid[]>(`/api/auctions/${auctionId}/bids`);
  return response.data;
}

/**
 * Fetch personal bid history for the current user.
 */
export async function getMyBids(): Promise<any[]> {
  const response = await axiosInstance.get<any[]>("/api/users/me/bids");
  return response.data;
}
