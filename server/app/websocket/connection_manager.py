"""
WebSocket connection manager for real-time auction room broadcasting.
"""

from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    """
    Manages active WebSocket connections grouped by auction_id.
    Allows broadcasting instant updates (new bids, timer extensions, auction closure)
    to all clients viewing a specific auction page.
    """

    def __init__(self):
        # Map: auction_id -> list of active WebSocket connections
        self._active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, auction_id: str, websocket: WebSocket) -> None:
        """Accept connection and register websocket in auction room."""
        await websocket.accept()
        if auction_id not in self._active_connections:
            self._active_connections[auction_id] = []
        self._active_connections[auction_id].append(websocket)
        print(f"[WebSocket] Client connected to auction '{auction_id}'. Total in room: {len(self._active_connections[auction_id])}", flush=True)

    def disconnect(self, auction_id: str, websocket: WebSocket) -> None:
        """Remove websocket from auction room on disconnect."""
        if auction_id in self._active_connections:
            if websocket in self._active_connections[auction_id]:
                self._active_connections[auction_id].remove(websocket)
            if not self._active_connections[auction_id]:
                del self._active_connections[auction_id]
        print(f"[WebSocket] Client disconnected from auction '{auction_id}'.", flush=True)

    async def broadcast(self, auction_id: str, message: dict) -> None:
        """
        Broadcast JSON payload to all active WebSocket clients in the auction room.
        Stale or broken connections are automatically cleaned up.
        """
        if auction_id not in self._active_connections:
            return

        stale_sockets: List[WebSocket] = []
        for connection in list(self._active_connections[auction_id]):
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"[WebSocket] Failed to send message to client: {e}", flush=True)
                stale_sockets.append(connection)

        # Cleanup stale connections
        for stale in stale_sockets:
            self.disconnect(auction_id, stale)


# Global singleton instance used throughout the app
manager = ConnectionManager()
