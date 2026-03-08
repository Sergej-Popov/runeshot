export function freezeRecoveryFraction(now: number, freezeStartedAt: number, freezeDurationMs: number): number {
  if (freezeStartedAt <= 0 || freezeDurationMs <= 0) return 0;
  const elapsed = Math.max(0, now - freezeStartedAt);
  return Math.max(0, Math.min(1, elapsed / freezeDurationMs));
}
