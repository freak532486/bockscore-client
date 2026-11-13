import "./loading-screen.css";

const FAKE_PROGRESS_LIMIT = 0.9;

/**
 * Controls the loading screen, which is part of index.html so that it is visible before the app has loaded. The
 * progress creeps forward on its own and jumps forward on every milestone.
 */
export class LoadingScreen {
    private readonly bar: HTMLElement;
    private readonly timer: number;
    private progress = 0;

    constructor(private readonly view: HTMLElement) {
        this.bar = view.querySelector(".progress-bar") as HTMLElement;
        this.timer = window.setInterval(() => {
            this.setProgress(this.progress + (FAKE_PROGRESS_LIMIT - this.progress) * 0.04);
        }, 100);
    }

    advance(progress: number) {
        this.setProgress(Math.max(this.progress, progress));
    }

    finish() {
        window.clearInterval(this.timer);
        this.setProgress(1);

        window.setTimeout(() => {
            this.view.classList.add("done");
            this.view.addEventListener("transitionend", () => this.view.remove(), { once: true });
        }, 250);
    }

    private setProgress(progress: number) {
        this.progress = progress;
        this.bar.style.width = `${Math.round(progress * 100)}%`;
        this.view.querySelector(".progress")?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    }
}
