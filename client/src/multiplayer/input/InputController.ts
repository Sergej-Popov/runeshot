import type { InputSnapshot } from "../types";

function isMovementKey(code: string): boolean {
  return code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD";
}

export class InputController {
  private readonly pressed = new Set<string>();
  private turnAccumulator = 0;
  private mouseDragging = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bind();
  }

  private bind(): void {
    this.canvas.tabIndex = 0;

    window.addEventListener("keydown", (event) => {
      if (isMovementKey(event.code) || event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        this.pressed.add(event.code);
        return;
      }

      if (
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight" ||
        event.code === "KeyQ" ||
        event.code === "KeyE"
      ) {
        event.preventDefault();
        this.pressed.add(event.code);
      }
    });

    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
    });

    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === this.canvas || this.mouseDragging) {
        this.turnAccumulator += event.movementX * 0.01;
      }
    });

    window.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.pressed.add("MouseLeft");
        this.mouseDragging = true;
      }
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.pressed.delete("MouseLeft");
        this.mouseDragging = false;
      }
    });

    this.canvas.addEventListener("click", () => {
      this.canvas.focus();
      if (document.pointerLockElement !== this.canvas) {
        const req = this.canvas.requestPointerLock();
        if (req && typeof req.catch === "function") {
          req.catch(() => {});
        }
      }
    });
  }

  consumeSnapshot(): InputSnapshot {
    const forward = (this.pressed.has("KeyW") ? 1 : 0) - (this.pressed.has("KeyS") ? 1 : 0);
    const strafe = (this.pressed.has("KeyD") ? 1 : 0) - (this.pressed.has("KeyA") ? 1 : 0);
    const turnFromKeys =
      (this.pressed.has("ArrowRight") || this.pressed.has("KeyE") ? 1 : 0) -
      (this.pressed.has("ArrowLeft") || this.pressed.has("KeyQ") ? 1 : 0);

    const snapshot: InputSnapshot = {
      forward,
      strafe,
      turn: this.turnAccumulator + turnFromKeys * 0.8,
      sprint: this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight"),
      shoot: this.pressed.has("MouseLeft"),
    };

    this.turnAccumulator = 0;
    return snapshot;
  }
}
