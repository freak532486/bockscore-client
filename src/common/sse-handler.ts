interface SSEEvent
{
    type: string,
    data?: any
}

export type SSECallback = (data?: any) => void;

export class SSEHandler
{
    private readonly eventSource: EventSource;
    private handlers: Map<string, Set<SSECallback>> = new Map();

    constructor() {
        this.eventSource = new EventSource("/api/events");
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