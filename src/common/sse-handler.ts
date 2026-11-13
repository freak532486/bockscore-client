import type { App } from "./app";

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

            /* The server sends named events (`event: <type>`), so every type needs its own listener */
            for (const type of this.handlers.keys()) {
                this.listen(this.eventSource, type);
            }
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

            if (this.eventSource !== undefined) {
                this.listen(this.eventSource, type);
            }
        }

        handlers.add(fn);
    }

    private listen(eventSource: EventSource, type: string)
    {
        eventSource.addEventListener(type, (event: MessageEvent) => {
            let data: any = undefined;
            try {
                data = event.data ? JSON.parse(event.data) : undefined;
            } catch {
                data = event.data;
            }

            for (const handler of this.handlers.get(type) ?? []) {
                handler(data);
            }
        });
    }
}
