import type { App } from "./app";

interface SSEEvent
{
    type: string,
    data?: any
}

export type SSECallback = (data?: any) => void;

export class SSEHandler
{
    private eventSource: EventSource | undefined;
    private handlers: Map<string, Set<SSECallback>> = new Map();

    constructor(app: App) {
        const subscribeToEventSource = (rankingId: string) => {
            if (this.eventSource !== undefined) {
                this.eventSource.close();
                this.eventSource = undefined;
            }

            this.eventSource = new EventSource("/api/ranking/" + rankingId + "/events");
            this.eventSource.onmessage = (event) => {
                const message = JSON.parse(event.data) as SSEEvent;

                const handlers = this.handlers.get(message.type);
                if (!handlers) {
                    return;
                }

                for (const handler of handlers) {
                    handler(message.data);
                }
            };
        }

        app.selectedRankingId.subscribe((val, prev) => {
            if (val == null && this.eventSource !== undefined) {
                this.eventSource.close();
                this.eventSource = undefined;
                return;
            }

            if (val !== null) {
                subscribeToEventSource(val);
            }
        });
    }

    /**
     * Subscribes to an event of the given type. The payload is given into the event handler.
     */
    subscribe(type: string, fn: SSECallback)
    {
        let handlers = this.handlers.get(type);

        if (!handlers) {
            handlers = new Set();
            this.handlers.set(type, handlers);
        }

        handlers.add(fn);
    }
}