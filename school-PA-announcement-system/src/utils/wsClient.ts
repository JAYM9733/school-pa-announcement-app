import { WSMessage } from '../types';

type MessageListener = (msg: WSMessage) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageListener> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isExplicitlyClosed = false;
  private serverUrl = '';
  private registrationPayload: any = null;
  public isConnected = false;

  public connect(customHost?: string, registration?: any) {
    if (registration) {
      this.registrationPayload = registration;
    }

    if (this.socket) {
      this.isExplicitlyClosed = true;
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }

    this.isExplicitlyClosed = false;

    // Determine WS target URL
    let wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = customHost ? customHost.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '') : window.location.host;

    // If on Cloud Run or proxy, window.location.host handles standard port
    this.serverUrl = `${wsProto}//${host}/ws`;

    try {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Register role and device details if provided
        if (this.registrationPayload) {
          this.send({
            type: 'register',
            payload: this.registrationPayload,
          });
        }

        // Start heartbeat ping
        this.startHeartbeat();

        this.notifyListeners({
          type: 'init',
          payload: { connected: true },
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          this.notifyListeners(data);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WS error:', err);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.notifyListeners({
          type: 'heartbeat',
          payload: { connected: false },
        });

        if (!this.isExplicitlyClosed) {
          // Auto-reconnect with 3-second delay
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect(customHost, this.registrationPayload);
            }, 3000);
          }
        }
      };
    } catch (e) {
      console.error('WS connection initialization error:', e);
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect(customHost, this.registrationPayload);
        }, 3000);
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat', payload: { time: Date.now() } });
      }
    }, 4000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public send(msg: WSMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  public subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(msg: WSMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Error in WS listener:', err);
      }
    });
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.isConnected = false;
  }
}

export const wsClient = new WebSocketService();
