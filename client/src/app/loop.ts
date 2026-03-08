export function computeDeltaSeconds(now: number, lastTime: number, maxDelta = 0.05): number {
  return Math.min(maxDelta, (now - lastTime) / 1000);
}

export function createFrameHarness(initialNow = 0, maxDelta = 0.05): {
  step: (now: number) => number;
  getLastNow: () => number;
} {
  let last = initialNow;
  return {
    step(now: number): number {
      const dt = computeDeltaSeconds(now, last, maxDelta);
      last = now;
      return dt;
    },
    getLastNow(): number {
      return last;
    },
  };
}
