import axiosInstance from "./axiosInstance";
import type {
  Auction,
  AuctionFilterParams,
  AuctionUpdatePayload,
  PaginatedResponse,
} from "../types";

/**
 * Fetch a paginated list of auctions with optional filters.
 */
export async function getAuctions(
  params?: AuctionFilterParams
): Promise<PaginatedResponse<Auction>> {
  const response = await axiosInstance.get<PaginatedResponse<Auction>>("/api/auctions", {
    params,
  });
  return response.data;
}

/**
 * Fetch full details for a single auction by ID.
 */
export async function getAuction(id: string): Promise<Auction> {
  const response = await axiosInstance.get<Auction>(`/api/auctions/${id}`);
  return response.data;
}

/**
 * Create a new auction listing with multipart/form-data (supports up to 5 images).
 */
export async function createAuction(formData: FormData): Promise<Auction> {
  const response = await axiosInstance.post<Auction>("/api/auctions", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

/**
 * Update an existing auction (seller only, auction must be open).
 */
export async function updateAuction(
  id: string,
  payload: AuctionUpdatePayload
): Promise<Auction> {
  const response = await axiosInstance.put<Auction>(`/api/auctions/${id}`, payload);
  return response.data;
}

/**
 * Permanently delete an auction (seller only, no bids placed yet).
 */
export async function deleteAuction(id: string): Promise<void> {
  await axiosInstance.delete(`/api/auctions/${id}`);
}

/**
 * Mark a paid auction as shipped (seller only).
 */
export async function markShipped(id: string): Promise<import("../types").Auction> {
  const response = await axiosInstance.put<import("../types").Auction>(`/api/auctions/${id}/shipped`);
  return response.data;
}
