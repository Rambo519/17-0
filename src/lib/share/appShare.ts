import { PRODUCT_NAME, SHARE_INVITE } from "@/lib/brand";

export interface AppSharePayload {
  title: string;
  text: string;
  url: string;
}

/** App home URL from the current origin. Never a game or results path. */
export function appShareUrl(origin: string = window.location.origin): string {
  return new URL("/", origin).href;
}

export function appSharePayload(origin?: string): AppSharePayload {
  return {
    title: PRODUCT_NAME,
    text: SHARE_INVITE,
    url: appShareUrl(origin),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export type ShareAppResult = "shared" | "copied" | "aborted";

/**
 * Native share sheet when the browser supports it; otherwise copy the plain
 * origin URL. Never includes a record or scoring stats.
 */
export async function shareAppInvite(): Promise<ShareAppResult> {
  const payload = appSharePayload();
  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare(payload)) {
        await navigator.share(payload);
        return "shared";
      }
    } catch (error) {
      if (isAbortError(error)) return "aborted";
    }
  }

  await navigator.clipboard.writeText(payload.url);
  return "copied";
}
