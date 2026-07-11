import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import "./wheel.css";
import template from "./wheel.html";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;

const WHEEL_COLOR_DISABLED = "#222222";

const WHEEL_COLORS = [
    "#bc2424",
    "#003cff",
    "#31e831",
    "#FFDD00",
]

const WHEEL_TEXT_COLORS = [
    "#DDDDDD",
    "#DDDDDD",
    "#222222",
    "#222222"
];

const WHEEL_MAX_ENTRY_LENGTH = 25;
const SPIN_SPEED_IDLE = 20; // degrees per second

const SPIN_TIME_SECONDS = 10;
const WIN_EVENT_DELAY_SECONDS = 0.5;
const NUM_SPINS = 10;

interface Spin
{
    startTs: number,
    sourceAngle: number,
    targetAngle: number
}

export class WheelComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly audioCtx = new AudioContext();
    private sndSpin: AudioBuffer | undefined;

    private lastTs: number = 0;
    private rotation: number = 0;
    private timeoutHandle: number | undefined;
    private _entries: Array<string>;

    private spinData: Spin | undefined;

    constructor(entries: Array<string>) {
        this._entries = [...entries];
        this.view = htmlToElement(template);
        const canvas = this.view.querySelector("canvas") as HTMLCanvasElement;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;

        this.drawWheel(ctx, entries);

        /* Load the click sound */
        this.loadSpinSound();

        /* Initial spin animation */
        const anim = (ts: number) => {
            this.wheelAnimation(ctx, ts);
            requestAnimationFrame(anim);
        }

        anim(0);
    }

    private async loadSpinSound()
    {
        const res = await fetch("/sounds/spin.mp3");
        const arr = await res.arrayBuffer();
        this.sndSpin = await this.audioCtx.decodeAudioData(arr);
    }

    private playSpinSound() {
        if (this.sndSpin == undefined) {
            return;
        }

        const source = this.audioCtx.createBufferSource();
        source.buffer = this.sndSpin;
        source.connect(this.audioCtx.destination);
        source.start();
    }

    private wheelAnimation(ctx: CanvasRenderingContext2D, ts: number) {
        if (this.lastTs == 0) {
            this.lastTs = ts;
            return;
        }

        const elapsedMs = ts - this.lastTs;
        this.lastTs = ts;

        /* Apply idle spin if no spin is happening, otherwise actual spin */
        const oldActiveEntry = this.getActiveEntryIdx();
        if (this.spinData == undefined) {
            const angleDeg = SPIN_SPEED_IDLE * elapsedMs / 1000;
            const angleRad = 2 * Math.PI * angleDeg / 360;
            this.rotation = (this.rotation + angleRad) % (2 * Math.PI);
        } else {
            this.rotation = getAnimAngle(this.spinData, ts);
        }

        /* Play click sound when not idle */
        if (this.getActiveEntryIdx() !== oldActiveEntry && this.sndSpin !== undefined && this.spinData !== undefined) {
            this.playSpinSound();
        }

        /* Rotate canvas */
        this.drawWheel(ctx, this.entries);
    }

    public spin(onWin: (entry: string) => void)
    {
        this.stopTimeout();

        if (this._entries.length == 0) {
            return;
        }

        const slicePerEntry = 2 * Math.PI / this.entries.length;
        const targetAngle = Math.random() * 2 * Math.PI;
        const winningEntryIdx = (this.entries.length - 1) - Math.floor(normalizeAngle(targetAngle - Math.PI / 2) / slicePerEntry);
        const winningEntry = this.entries[winningEntryIdx]!;
        this.spinData = {
            startTs: this.lastTs,
            sourceAngle: this.rotation,
            targetAngle: targetAngle
        };

        this.timeoutHandle = setTimeout(() => onWin(winningEntry), (SPIN_TIME_SECONDS + WIN_EVENT_DELAY_SECONDS) * 1000);
    }

    public idle() {
        this.stopTimeout();
        this.spinData = undefined;
    }

    get entries() {
        return this._entries;
    }

    set entries(entries: Array<string>) {
        this.idle();
        this._entries = [...entries];
    }

    removeEntry(entry: string) {
        const idx = this._entries.findIndex(x => x == entry);
        if (idx == -1) {
            return;
        }

        this._entries.splice(idx, 1);
    }

    private stopTimeout() {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
    }

    private drawWheel(
        ctx: CanvasRenderingContext2D,
        entries: string[]
    ) {
        const cx = CANVAS_WIDTH / 2;
        const cy = CANVAS_HEIGHT / 2;
        const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.45;
        const sliceAngle = (Math.PI * 2) / entries.length;

        const fontSize = calculateFontSize(
            ctx,
            entries,
            radius
        );

        /* Clear canvas */
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        /* Apply translation and rotation */
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.translate(-cx, -cy);

        /* Predraw shadow */
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        /* No shadow between slices */
        ctx.shadowColor = "rgba(0, 0, 0, 0.0)";

        let i = 0;
        entries.forEach((label, index) => {
            const start = index * sliceAngle - Math.PI / 2;
            const end = start + sliceAngle;

            // Alternate colours
            ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]!;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end);
            ctx.closePath();
            ctx.fill();

            // Draw the label.
            const textAngle = start + sliceAngle / 2;

            ctx.save();

            ctx.translate(cx, cy);
            ctx.rotate(textAngle);

            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = WHEEL_TEXT_COLORS[i % WHEEL_TEXT_COLORS.length]!;
            ctx.font = "${fontSize}px sans-serif";

            // Position the text roughly 75% of the way out.
            ctx.fillText(truncated(label), radius - 20, 0);

            ctx.restore();
            i += 1;
        });

        /* Draw in gray if no entries */
        if (entries.length == 0) {
            ctx.fillStyle = WHEEL_COLOR_DISABLED;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
        }

        // Centre hub.
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.stroke();

        /* Win indicator */
        ctx.fillStyle = WHEEL_COLORS[this.getActiveEntryIdx() % WHEEL_COLORS.length]!;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(cx + radius - 10, cy);
        ctx.lineTo(cx + radius + 30, cy - 25);
        ctx.lineTo(cx + radius + 30, cy + 25);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
    }

    private getActiveEntryIdx(): number
    {
        const slice = (2 * Math.PI) / this.entries.length;
        let angle = Math.PI / 2 - this.rotation;
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return Math.floor(angle / slice);
    }
}

function calculateFontSize(
    ctx: CanvasRenderingContext2D,
    entries: string[],
    radius: number
): number {
    if (entries.length === 0) {
        return 24;
    }

    const longest = entries.reduce(
        (a, b) => truncated(a).length >= truncated(b).length ? a : b
    );

    const text = truncated(longest);
    const maxWidth = radius * 0.7;
    const maxHeight = 0.6 * (2 * radius * Math.PI) / entries.length;

    let low = 8;
    let high = 128;

    while (low < high) {
        const mid = Math.ceil((low + high) / 2);

        ctx.font = `${mid}px sans-serif`;

        const measurements = ctx.measureText(text);
        const height = measurements.fontBoundingBoxAscent + measurements.fontBoundingBoxDescent;
        if (measurements.width <= maxWidth && height <= maxHeight) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    return low;
}


function getAnimAngle(spin: Spin, ts: number): number
{
    const elapsed = ts - spin.startTs;
    if (elapsed > SPIN_TIME_SECONDS * 1000) {
        return spin.targetAngle;
    }

    if (elapsed < 0) {
        return spin.sourceAngle;
    }

    const k = elapsed / (SPIN_TIME_SECONDS * 1000);
    const eased = easeOut(k);
    const actualTarget = spin.targetAngle + 2 * Math.PI * NUM_SPINS;

    return (actualTarget * eased + spin.sourceAngle * (1 - eased)) % (2 * Math.PI);
}

function easeOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    return 1 - Math.pow(2, -10 * t) + Math.pow(2, -10);
}



function truncated(str: string)
{
    if (str.length < WHEEL_MAX_ENTRY_LENGTH) {
        return str;
    }

    return str.substring(0, WHEEL_MAX_ENTRY_LENGTH - 3) + "...";
}

function normalizeAngle(angle: number) {
    let ret = angle % (2 * Math.PI);
    if (ret < 0) {
        ret += 2 * Math.PI;
    }
    return ret;
}