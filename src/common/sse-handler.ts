import type { App } from "./app";

/**
 * The sender id is the id of the user who caused the event.
 */
export type SSECallback = (data?: unknown, senderId?: string) => void;

/**
 * Pseudo event that is emitted after the connection was re-established. Events sent while the connection was down are
 * lost, so subscribers should re-fetch their state.
 */
export const EVENT_RECONNECTED = "reconnected";

const RECONNECT_DELAY_MS = 5000;

export class SSEHandler {
    private eventSource: EventSource | undefined;
    private rankingId: string | null = null;
    private reconnectTimeout: number | undefined;
    private handlers: Map<string, Set<SSECallback>> = new Map();

    constructor(app: App) {
        app.selectedRankingId.subscribe((val) => {
            this.rankingId = val;
            this.connect();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && this.eventSource?.readyState === EventSource.CLOSED) {
                this.connect();
            }
        });
    }

    /**
     * Subscribes to an event of the given type. The payload is given into the event handler.
     */
    subscribe(type: string, fn: SSECallback) {
        let handlers = this.handlers.get(type);

        if (!handlers) {
            handlers = new Set();
            this.handlers.set(type, handlers);

            if (this.eventSource !== undefined) {
                this.listen(this.eventSource, type);
            }
        }

        handlers.add(fn);
    }

    private connect() {
        window.clearTimeout(this.reconnectTimeout);
        this.eventSource?.close();
        this.eventSource = undefined;

        if (this.rankingId === null) {
            return;
        }

        const eventSource = new EventSource("/api/ranking/" + this.rankingId + "/events");
        this.eventSource = eventSource;

        /* The server sends named events (`event: <type>`), so every type needs its own listener */
        for (const type of this.handlers.keys()) {
            this.listen(eventSource, type);
        }

        let opened = false;
        eventSource.onopen = () => {
            if (opened) {
                this.emit(EVENT_RECONNECTED);
            }

            opened = true;
        };

        /* The browser reconnects by itself after network errors, but gives up after HTTP errors */
        eventSource.onerror = () => {
            if (eventSource.readyState !== EventSource.CLOSED || eventSource !== this.eventSource) {
                return;
            }

            this.reconnectTimeout = window.setTimeout(() => {
                this.connect();
                this.emit(EVENT_RECONNECTED);
            }, RECONNECT_DELAY_MS);
        };
    }

    private emit(type: string, data?: unknown, senderId?: string) {
        for (const handler of this.handlers.get(type) ?? []) {
            handler(data, senderId);
        }
    }

    private listen(eventSource: EventSource, type: string) {
        eventSource.addEventListener(type, (event: MessageEvent) => {
            let data: unknown;
            try {
                data = event.data ? JSON.parse(event.data) : undefined;
            } catch {
                data = event.data;
            }

            this.emit(type, data, event.lastEventId || undefined);
        });
    }
}
