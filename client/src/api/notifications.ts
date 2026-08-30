/**
 * Notification API functions — fetch notifications and mark them as read.
 */

import axiosInstance from "./axiosInstance";
import type { Notification } from "../types";

/**
 * Fetch all notifications for the authenticated user.
 */
export async function getNotifications(): Promise<Notification[]> {
  const res = await axiosInstance.get<Notification[]>("/api/users/me/notifications");
  return res.data;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await axiosInstance.put<Notification>(`/api/notifications/${id}/read`);
  return res.data;
}

/**
 * Mark ALL unread notifications as read in a single batch.
 * Fires requests in parallel for speed.
 */
export async function markAllNotificationsRead(
  notifications: Notification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.is_read);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}
