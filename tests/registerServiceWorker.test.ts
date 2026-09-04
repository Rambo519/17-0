import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SERVICE_WORKER_URL,
  SKIP_WAITING_MESSAGE,
  registerServiceWorker,
} from "@/lib/pwa/registerServiceWorker";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeRegistration(overrides: Partial<ServiceWorkerRegistration> = {}) {
  return {
    waiting: null,
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

function fakeContainer(
  overrides: Partial<ServiceWorkerContainer> & {
    register: ServiceWorkerContainer["register"];
  },
) {
  return {
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as ServiceWorkerContainer;
}

describe("registerServiceWorker", () => {
  it("registers, checks for an update, and skips a worker already waiting", async () => {
    const waiting = { postMessage: vi.fn() };
    const registration = fakeRegistration({
      waiting: waiting as unknown as ServiceWorker,
    });
    const register = vi.fn().mockResolvedValue(registration);
    const sw = fakeContainer({ register });

    registerServiceWorker(sw);

    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: "/" });
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
    expect(waiting.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
    expect(sw.addEventListener).not.toHaveBeenCalled();
  });

  it("reloads once when a new worker takes over an already-controlled page", () => {
    const reload = vi.fn();
    const listeners = new Map<string, EventListener>();
    const register = vi.fn().mockResolvedValue(fakeRegistration());
    const sw = fakeContainer({
      controller: {} as ServiceWorker,
      register,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
    });

    registerServiceWorker(sw, { reload });
    expect(listeners.has("controllerchange")).toBe(true);
    listeners.get("controllerchange")?.(new Event("controllerchange"));
    listeners.get("controllerchange")?.(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on the first install when nothing was controlling the page", () => {
    const reload = vi.fn();
    const register = vi.fn().mockResolvedValue(fakeRegistration());
    const sw = fakeContainer({ register });

    registerServiceWorker(sw, { reload });
    expect(sw.addEventListener).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
