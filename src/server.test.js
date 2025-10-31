import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  startTestServer,
  stopTestServer,
  makeHttpRequest,
  testStreamStarts,
} from "../test/helpers.js";

const BASE_TEST_PORT = 13000;
const TEST_DIR_PREFIX = "racoder-test-";
const INPUT_STREAM = "https://example.com/stream1.m3u8";

let testDir;

const getRandomPort = () => BASE_TEST_PORT + Math.floor(Math.random() * 100);

describe("server.js", () => {
  before(() => {
    testDir = mkdtempSync(TEST_DIR_PREFIX);
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("single stream mode", () => {
    const TEST_PORT = getRandomPort();
    const BASE_URL = `http://localhost:${TEST_PORT}`;
    let serverProcess;

    afterEach(async () => {
      await stopTestServer(serverProcess);
    });

    it("should start server and respond to healthcheck", async () => {
      const server = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/test-stream",
          BITRATE: "128k",
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const response = await makeHttpRequest(`${BASE_URL}/healthcheck`);
      assert.equal(response.statusCode, 200);
    });

    it("should serve stream at configured OUTPUT_PATH", async () => {
      const server = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/my-radio",
          BITRATE: "128k",
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const started = await testStreamStarts(`${BASE_URL}/my-radio`);
      assert.ok(started);
    });

    it("should serve stream at root path when OUTPUT_PATH is /", async () => {
      const server = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/",
          BITRATE: "128k",
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const started = await testStreamStarts(`${BASE_URL}/`);
      assert.ok(started);
    });

    it("should return 404 for unknown paths", async () => {
      const server = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/test-stream",
          BITRATE: "128k",
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const response = await makeHttpRequest(`${BASE_URL}/unknown-path`);
      assert.equal(response.statusCode, 404);
    });

    it("should normalize URLs by removing trailing slashes", async () => {
      const server = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/test-stream",
          BITRATE: "128k",
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const started = await testStreamStarts(`${BASE_URL}/test-stream/`);
      assert.ok(started);
    });
  });

  describe("multi-stream mode", () => {
    const TEST_PORT = getRandomPort() + 100;
    const BASE_URL = `http://localhost:${TEST_PORT}`;
    let serverProcess;

    afterEach(async () => {
      await stopTestServer(serverProcess);
    });

    it("should serve multiple streams from config file", async () => {
      const configPath = join(testDir, "multi-stream-config.json");
      const config = {
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            output: "/stream1",
            bitrate: "128k",
          },
          {
            input: "https://example.com/stream2.m3u8",
            output: "/stream2",
            bitrate: "192k",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      const server = await startTestServer(
        {
          STREAMS_FILE: configPath,
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const stream1Started = await testStreamStarts(`${BASE_URL}/stream1`);
      assert.ok(stream1Started);

      const stream2Started = await testStreamStarts(`${BASE_URL}/stream2`);
      assert.ok(stream2Started);
    });

    it("should return 404 for unconfigured paths in multi-stream mode", async () => {
      const configPath = join(testDir, "multi-stream-404.json");
      const config = {
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            output: "/stream1",
            bitrate: "128k",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      const server = await startTestServer(
        {
          STREAMS_FILE: configPath,
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const response = await makeHttpRequest(`${BASE_URL}/stream2`);
      assert.equal(response.statusCode, 404);
    });

    it("should apply default bitrate from config", async () => {
      // Given
      const configPath = join(testDir, "defaults-config.json");
      const config = {
        defaults: {
          bitrate: "256k",
        },
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            output: "/stream1",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      // When
      const server = await startTestServer(
        {
          STREAMS_FILE: configPath,
        },
        TEST_PORT
      );
      serverProcess = server.process;

      const response = await makeHttpRequest(`${BASE_URL}/healthcheck`);

      // Then
      assert.equal(response.statusCode, 200);
    });
  });

  describe("graceful shutdown", () => {
    const TEST_PORT = getRandomPort() + 300;
    const BASE_URL = `http://localhost:${TEST_PORT}`;

    it("should handle SIGTERM signal", async () => {
      const { process: serverProcess, getOutput } = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/test-stream",
          BITRATE: "128k",
        },
        TEST_PORT
      );

      const response = await makeHttpRequest(`${BASE_URL}/healthcheck`);
      assert.equal(response.statusCode, 200);

      const exitCode = await new Promise((resolve) => {
        serverProcess.on("exit", (code) => {
          resolve(code);
        });
        serverProcess.kill("SIGTERM");
      });

      const output = getOutput();

      assert.equal(exitCode, 0);
      assert.match(output, /SIGTERM received. Stopping server …/);
    });

    it("should handle SIGINT signal", async () => {
      const { process: serverProcess, getOutput } = await startTestServer(
        {
          INPUT_STREAM,
          OUTPUT_PATH: "/test-stream",
          BITRATE: "128k",
        },
        TEST_PORT
      );

      const response = await makeHttpRequest(`${BASE_URL}/healthcheck`);
      assert.equal(response.statusCode, 200);

      // Send SIGINT
      const exitCode = await new Promise((resolve) => {
        serverProcess.on("exit", (code) => {
          resolve(code);
        });
        serverProcess.kill("SIGINT");
      });

      const output = getOutput();

      assert.equal(exitCode, 0);
      assert.match(output, /SIGINT received. Stopping server …/);
    });
  });
});
