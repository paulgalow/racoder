import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  validateEnv,
  loadConfig,
  log,
  getTimeZone,
  LOG_LEVELS,
} from "./utils.js";

const TEST_DIR_PREFIX = "racoder-test-";

describe("utils.js", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnv", () => {
    describe("single stream mode", () => {
      it("should validate successfully with all required env vars", () => {
        process.env.INPUT_STREAM = "https://example.com/stream.m3u8";
        process.env.OUTPUT_PATH = "/test-stream";
        process.env.BITRATE = "192k";
        process.env.LOG_LEVEL = "DEBUG";
        process.env.TZ = "America/New_York";
        process.env.HTTP_PORT = "8080";

        const result = validateEnv();

        assert.equal(result.INPUT_STREAM, "https://example.com/stream.m3u8");
        assert.equal(result.OUTPUT_PATH, "/test-stream");
        assert.equal(result.BITRATE, "192k");
        assert.equal(result.LOG_LEVEL, "DEBUG");
        assert.equal(result.TZ, "America/New_York");
        assert.equal(result.HTTP_PORT, "8080");
      });

      it("should set default values for optional env vars", () => {
        process.env.INPUT_STREAM = "https://example.com/stream.m3u8";

        const result = validateEnv();

        assert.equal(result.OUTPUT_PATH, "/");
        assert.equal(result.BITRATE, "128k");
        assert.equal(result.LOG_LEVEL, "INFO");
        assert.equal(result.TZ, "UTC");
        assert.equal(result.HTTP_PORT, "3000");
      });

      it("should throw error when INPUT_STREAM is missing", () => {
        delete process.env.INPUT_STREAM;
        delete process.env.STREAMS_FILE;

        assert.throws(() => validateEnv(), {
          message: "'INPUT_STREAM' environment variable is not set.",
        });
      });

      it("should throw error when INPUT_STREAM is not a valid URL", () => {
        process.env.INPUT_STREAM = "not-a-url";

        assert.throws(() => validateEnv(), {
          message: "'INPUT_STREAM' environment variable is not a valid URL.",
        });
      });
    });

    describe("multi-stream mode", () => {
      it("should skip single stream validation when STREAMS_FILE is set", () => {
        process.env.STREAMS_FILE = "/config/streams.json";
        delete process.env.INPUT_STREAM;

        // Should not throw
        const result = validateEnv();
        assert.equal(result.STREAMS_FILE, "/config/streams.json");
      });
    });
  });

  describe("loadConfig", () => {
    let testDir;

    beforeEach(() => {
      testDir = mkdtempSync(TEST_DIR_PREFIX);
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it("should return null when STREAMS_FILE is not set", () => {
      delete process.env.STREAMS_FILE;
      const result = loadConfig();
      assert.equal(result, null);
    });

    it("should load and validate a valid config file", () => {
      const configPath = join(testDir, "valid-config.json");
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
      process.env.STREAMS_FILE = configPath;

      const result = loadConfig();

      assert.equal(result.streams.length, 2);
      assert.equal(result.streams[0].input, "https://example.com/stream1.m3u8");
      assert.equal(result.streams[0].output, "/stream1");
      assert.equal(result.streams[0].bitrate, "128k");
    });

    it("should apply default bitrate from config", () => {
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
      process.env.STREAMS_FILE = configPath;

      const result = loadConfig();

      assert.equal(result.streams[0].bitrate, "256k");
    });

    it("should throw error for invalid JSON", () => {
      const configPath = join(testDir, "invalid.json");
      writeFileSync(configPath, "{ invalid json }");
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Failed to load config file/,
      });
    });

    it("should throw error for missing streams array", () => {
      const configPath = join(testDir, "no-streams.json");
      writeFileSync(configPath, JSON.stringify({}));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Config must include a 'streams' array/,
      });
    });

    it("should throw error for empty streams array", () => {
      const configPath = join(testDir, "empty-streams.json");
      writeFileSync(configPath, JSON.stringify({ streams: [] }));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Config must specify at least one stream/,
      });
    });

    it("should throw error for missing input field", () => {
      const configPath = join(testDir, "missing-input.json");
      const config = {
        streams: [
          {
            output: "/stream1",
            bitrate: "128k",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Stream at index 0 missing 'input' field/,
      });
    });

    it("should throw error for invalid input URL", () => {
      const configPath = join(testDir, "invalid-url.json");
      const config = {
        streams: [
          {
            input: "not-a-url",
            output: "/stream1",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Stream at index 0 has invalid 'input' URL/,
      });
    });

    it("should throw error for missing output field", () => {
      const configPath = join(testDir, "missing-output.json");
      const config = {
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            bitrate: "128k",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Stream at index 0 is missing 'output' field/,
      });
    });

    it("should throw error for output path not starting with /", () => {
      const configPath = join(testDir, "invalid-output.json");
      const config = {
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            output: "stream1",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Stream at index 0 'output' must start with '\/': stream1/,
      });
    });

    it("should throw error for duplicate output paths", () => {
      const configPath = join(testDir, "duplicate-output.json");
      const config = {
        streams: [
          {
            input: "https://example.com/stream1.m3u8",
            output: "/stream1",
          },
          {
            input: "https://example.com/stream2.m3u8",
            output: "/stream1",
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      process.env.STREAMS_FILE = configPath;

      assert.throws(() => loadConfig(), {
        message: /Duplicate output path '\/stream1' found in config/,
      });
    });

    it("should throw error for non-existent config file", () => {
      process.env.STREAMS_FILE = "/non/existent/file.json";

      assert.throws(() => loadConfig(), {
        message: /Failed to load config file/,
      });
    });
  });

  describe("getTimeZone", () => {
    it("should return a valid timezone string", () => {
      const tz = getTimeZone();
      assert.ok(typeof tz === "string");
      assert.ok(tz.length > 0);
    });
  });

  describe("log", () => {
    it("should handle INFO log level", () => {
      assert.doesNotThrow(() => {
        log("Info message", LOG_LEVELS.INFO);
      });
    });

    it("should handle DEBUG log level", () => {
      process.env.LOG_LEVEL = "DEBUG";
      assert.doesNotThrow(() => {
        log("Debug message", LOG_LEVELS.DEBUG);
      });
    });
  });
});
