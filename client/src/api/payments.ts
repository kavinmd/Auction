/**
 * Payment API functions — create Stripe checkout sessions.
 */

import axiosInstance from "./axiosInstance";
import type { Payment } from "../types";

export interface CheckoutResponse {
  checkout_url: string;
  payment: Payment;
}

/**
 * Create a Stripe Checkout session for a won auction.
 * Returns the redirect URL for the Stripe-hosted checkout page.
 */
export async function createCheckoutSession(
  auctionId: string
): Promise<CheckoutResponse> {
  const res = await axiosInstance.post<CheckoutResponse>(
    `/api/payments/checkout/${auctionId}`
  );
  return res.data;
}

/**
 * Fetch the payment record for a given auction (winner only).
 */
export async function getPaymentByAuction(auctionId: string): Promise<Payment> {
  const res = await axiosInstance.get<Payment>(`/api/payments/auction/${auctionId}`);
  return res.data;
}
