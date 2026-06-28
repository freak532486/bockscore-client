export type ChangeListener<T> = (value: T, previous: T) => void;

/**
 * An observable type. Can be get and set just like the normal type, but you can attach listeners that notify you of 
 * any state changes.
 */
export class Observable<T> {
    private _value: T;
    private readonly listeners = new Set<ChangeListener<T>>();

    constructor(initialValue: T) {
        this._value = initialValue;
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        if (Object.is(this.value, value)) {
            return;
        }

        const previous = this.value;
        this._value = value;

        for (const listener of this.listeners) {
            listener(value, previous);
        }
    }

    subscribe(listener: ChangeListener<T>): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}