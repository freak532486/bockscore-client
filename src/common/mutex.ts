export class Mutex {
    private locked = false;
    private waiters: (() => void)[] = [];

    private async lock(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return () => this.unlock();
        }

        return new Promise(resolve => {
            this.waiters.push(() => {
                this.locked = true;
                resolve(() => this.unlock());
            });
        });
    }

    private unlock() {
        const next = this.waiters.shift();

        if (next) {
            next();
        } else {
            this.locked = false;
        }
    }

    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        const unlock = await this.lock();

        try {
            return await fn();
        } finally {
            unlock();
        }
    }
}