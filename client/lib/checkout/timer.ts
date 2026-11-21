export interface HoldTimerState {
  remainingSeconds: number;
  formattedTime: string;
  isExpired: boolean;
  skewMs: number;
}

/**
 * Computes remaining hold time based on server-provided deadline and server clock.
 * Skew = clientNow - serverNow
 * Elapsed = clientNow - baseClientTime
 * Estimated server now = serverClockTime + elapsed
 */
export function calculateHoldRemaining(
  expiresAt: string,
  serverNow: string,
  clientNow: number = Date.now(),
  receivedAtClientNow?: number
): HoldTimerState {
  const serverExpiryTime = new Date(expiresAt).getTime();
  const serverClockTime = new Date(serverNow).getTime();

  // If receivedAtClientNow is provided, skew is computed from when the serverNow snapshot was taken
  const baseClientTime = receivedAtClientNow ?? serverClockTime;
  const skewMs = baseClientTime - serverClockTime;

  // Estimated true server time right now
  const elapsed = clientNow - baseClientTime;
  const estimatedServerNow = serverClockTime + elapsed;

  const remainingMs = Math.max(0, serverExpiryTime - estimatedServerNow);
  const remainingSeconds = Math.floor(remainingMs / 1000);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    remainingSeconds,
    formattedTime,
    isExpired: remainingSeconds <= 0,
    skewMs,
  };
}
