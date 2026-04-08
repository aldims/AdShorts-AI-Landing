import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  fetchUpstreamResponse,
  UpstreamFetchError,
  type UpstreamFetchPolicy,
} from "./upstream-client.js";

const activeServers = new Set<ReturnType<typeof createServer>>();

const listenTestServer = async (
  handler: Parameters<typeof createServer>[0],
) => {
  const server = createServer(handler);
  activeServers.add(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    url: new URL(`http://127.0.0.1:${address.port}/resource`),
  };
};

afterEach(async () => {
  await Promise.all(
    Array.from(activeServers).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  activeServers.clear();
});

describe("upstream client", () => {
  it("fails within the total timeout budget", async () => {
    const { url } = await listenTestServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("late");
      }, 250);
    });
    const policy: UpstreamFetchPolicy = {
      name: "test-timeout",
      retryDelaysMs: [],
      retryableStatusCodes: new Set([503]),
      timeoutMs: 50,
    };
    const startedAt = Date.now();

    await expect(
      fetchUpstreamResponse(url, undefined, policy, {
        endpoint: "test.timeout",
      }),
    ).rejects.toMatchObject<Partial<UpstreamFetchError>>({
      isTimeout: true,
      name: "UpstreamFetchError",
    });

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("retries retryable statuses inside the total budget", async () => {
    let attempts = 0;
    const { url } = await listenTestServer((_req, res) => {
      attempts += 1;

      if (attempts === 1) {
        res.writeHead(503, { "content-type": "text/plain" });
        res.end("retry");
        return;
      }

      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });
    const policy: UpstreamFetchPolicy = {
      name: "test-retry",
      retryDelaysMs: [10],
      retryableStatusCodes: new Set([503]),
      timeoutMs: 500,
    };

    const response = await fetchUpstreamResponse(url, undefined, policy, {
      endpoint: "test.retry",
    });

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
  });
});
