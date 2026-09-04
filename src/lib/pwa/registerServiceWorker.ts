export const SERVICE_WORKER_URL = "/sw.js";
export const SKIP_WAITING_MESSAGE = "SKIP_WAITING";

interface RegisterServiceWorkerOptions {
  reload?: () => void;
}

/**
 * Register the app service worker, check for a waiting/updated worker, and
 * reload once when a new worker takes control.
 */
export function registerServiceWorker(
  serviceWorker: ServiceWorkerContainer | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.serviceWorker,
  options: RegisterServiceWorkerOptions = {},
): () => void {
  if (!serviceWorker) return () => undefined;

  const reload = options.reload ?? (() => window.location.reload());
  const hadController = Boolean(serviceWorker.controller);
  let reloading = false;

  const onControllerChange = () => {
    if (!hadController || reloading) return;
    reloading = true;
    reload();
  };

  if (hadController) {
    serviceWorker.addEventListener("controllerchange", onControllerChange);
  }

  void (async () => {
    try {
      const registration = await serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
      registration.waiting?.postMessage(SKIP_WAITING_MESSAGE);
      await registration.update();
    } catch {
      // Registration is best-effort; the app still runs without a worker.
    }
  })();

  return () => {
    serviceWorker.removeEventListener("controllerchange", onControllerChange);
  };
}
