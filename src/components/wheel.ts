import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./wheel.html"
import "./wheel.css"

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;

const WHEEL_COLORS = [
    "#bc2424",
    "#003cff",
    "#31e831",
    "#FFDD00"
]

const WHEEL_TEXT_COLORS = [
    "#DDDDDD",
    "#DDDDDD",
    "#222222",
    "#222222"
];

const WHEEL_MAX_ENTRY_LENGTH = 25;

export class WheelComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly entries: Array<string>) {
        this.view = htmlToElement(template);
        const canvas = this.view.querySelector("canvas") as HTMLCanvasElement;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;

        drawWheel(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, entries);
    }
}

function drawWheel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    entries: string[]
) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.45;

    const sliceAngle = (Math.PI * 2) / entries.length;

    ctx.clearRect(0, 0, width, height);

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
        ctx.font = "24px sans-serif";

        // Position the text roughly 75% of the way out.
        ctx.fillText(truncated(label), radius - 20, 0);

        ctx.restore();
        i += 1;
    });

    // Centre hub.
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.stroke();
}

function truncated(str: string)
{
    if (str.length < WHEEL_MAX_ENTRY_LENGTH) {
        return str;
    }

    return str.substring(0, WHEEL_MAX_ENTRY_LENGTH - 3) + "...";
}