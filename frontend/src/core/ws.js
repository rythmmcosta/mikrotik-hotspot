import { authStore } from '../store/auth.js';

const BASE_WS = window.location.protocol === 'https:' ? 'wss://' : 'ws://';

class WSClient {
    constructor(room) {
        this.room = room;
        this._ws = null;
        this._handlers = {};
        this._retryDelay = 1000;
        this._maxDelay = 30000;
        this._closed = false;
    }

    connect() {
        if (this._closed) return;
        const token = authStore.getAccessToken() || '';
        const host = window.location.host;
        const url = `${BASE_WS}${host}/api/v1/ws/${this.room}?token=${encodeURIComponent(token)}`;
        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            this._retryDelay = 1000;
            this._emit('open');
        };

        this._ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                this._emit('message', data);
                if (data.type) this._emit(data.type, data);
            } catch {}
        };

        this._ws.onclose = () => {
            if (!this._closed) {
                setTimeout(() => this.connect(), this._retryDelay);
                this._retryDelay = Math.min(this._retryDelay * 2, this._maxDelay);
            }
        };

        this._ws.onerror = () => {};
    }

    on(event, handler) {
        if (!this._handlers[event]) this._handlers[event] = [];
        this._handlers[event].push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!this._handlers[event]) return;
        this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    }

    _emit(event, data) {
        (this._handlers[event] || []).forEach(h => h(data));
    }

    close() {
        this._closed = true;
        if (this._ws) this._ws.close();
    }
}

export function createWSClient(room) {
    const client = new WSClient(room);
    client.connect();
    return client;
}
