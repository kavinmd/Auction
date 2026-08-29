"""
WebSocket endpoint for real-time auction room connection.

Endpoint: /ws/auctions/{auction_id}
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.connection_manager import manager

router = APIRouter()


@router.websocket("/ws/auctions/{auction_id}")
async def auction_websocket_endpoint(websocket: WebSocket, auction_id: str):
    """
    Accepts WebSocket connections for a given auction_id,
    registers the socket with ConnectionManager, and keeps the connection open
    until the client disconnects.
    """
    await manager.connect(auction_id, websocket)
    try:
        while True:
            # Keep connection alive & listen for client ping/messages
            data = await websocket.receive_text()
            # Optional ping-pong handler
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(auction_id, websocket)
    except Exception as e:
        print(f"[WebSocket Error] Connection error for auction '{auction_id}': {e}", flush=True)
        manager.disconnect(auction_id, websocket)
