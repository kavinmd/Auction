import { useEffect, useRef, useCallback } from "react";

export interface WsNewBidMessage {
  type: "new_bid";
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number;
  current_price: number;
  end_time: string;
  created_at: string;
}

export interface WsTimeExtendedMessage {
  type: "time_extended";
  auction_id: string;
  new_end_time: string;
}

export interface WsAuctionClosedMessage {
  type: "auction_closed";
  auction_id: string;
  winner_id: string | null;
  final_price: number;
}

export type WsMessage =
  | WsNewBidMessage
  | WsTimeExtendedMessage
  | WsAuctionClosedMessage;

export interface UseAuctionSocketOptions {
  onNewBid?: (data: WsNewBidMessage) => void;
  onTimeExtended?: (data: WsTimeExtendedMessage) => void;
  onAuctionClosed?: (data: WsAuctionClosedMessage) => void;
  enabled?: boolean;
}

export function useAuctionSocket(
  auctionId: string | undefined,
  options: UseAuctionSocketOptions = {}
) {
  const { onNewBid, onTimeExtended, onAuctionClosed, enabled = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  // Store latest callbacks in refs to prevent unnecessary re-connections
  const onNewBidRef = useRef(onNewBid);
  const onTimeExtendedRef = useRef(onTimeExtended);
  const onAuctionClosedRef = useRef(onAuctionClosed);

  useEffect(() => {
    onNewBidRef.current = onNewBid;
    onTimeExtendedRef.current = onTimeExtended;
    onAuctionClosedRef.current = onAuctionClosed;
  });

  const connect = useCallback(() => {
    if (!auctionId || !enabled) return;

    // Resolve WS protocol & host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/auctions/${auctionId}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log(`[WebSocket] Connected to auction '${auctionId}' room.`);
        backoffRef.current = 1000; // Reset backoff on successful connection
      };

      socket.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);
          switch (data.type) {
            case "new_bid":
              onNewBidRef.current?.(data);
              break;
            case "time_extended":
              onTimeExtendedRef.current?.(data);
              break;
            case "auction_closed":
              onAuctionClosedRef.current?.(data);
              break;
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      socket.onerror = (err) => {
        console.warn("[WebSocket] Socket error:", err);
      };

      socket.onclose = (event) => {
        console.log(`[WebSocket] Connection closed (${event.code}). Reconnecting...`);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (max 10s)
        if (enabled) {
          const delay = backoffRef.current;
          backoffRef.current = Math.min(backoffRef.current * 2, 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error("[WebSocket] Failed to create socket:", err);
    }
  }, [auctionId, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
