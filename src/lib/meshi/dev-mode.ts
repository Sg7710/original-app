/**
 * Serves MOCK_STORES instead of calling the paid Places/Routes APIs, so UI work
 * costs nothing. Only ever true under `next dev` with
 * NEXT_PUBLIC_USE_MOCK_STORES=true — production builds always use real stores.
 */
export function isMockStores(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_MOCK_STORES === "true"
  );
}

/**
 * Skips the login requirement. Only ever true under `next dev` with
 * NEXT_PUBLIC_DEV_MODE=true, so production builds always require login.
 */
export function isAuthBypassed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_MODE === "true";
}
