import { readFileSync } from "node:fs";

export const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
};

export function log(message, logLevel = LOG_LEVELS.INFO) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateTimeStamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  if (logLevel === LOG_LEVELS.INFO) {
    console.log(`${dateTimeStamp} - ${message}`);
    return;
  }

  if (logLevel === process.env.LOG_LEVEL) {
    console.debug(`${dateTimeStamp} - 🪲 ${message}`);
  }
}

export function getTimeZone() {
  const now = new Date();
  return Intl.DateTimeFormat("en", { timeZoneName: "short" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName").value;
}

export function loadConfig() {
  const configPath = process.env.STREAMS_FILE;

  if (!configPath) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);
    validateConfig(config);
    log(`Loaded configuration from '${configPath}'`);
    return config;
  } catch (error) {
    throw new Error(
      `🔴 Failed to load config file '${configPath}': ${error.message}`
    );
  }
}

function validateConfig(config) {
  if (!config.streams || !Array.isArray(config.streams)) {
    throw new Error("Config must include a 'streams' array");
  }

  if (config.streams.length === 0) {
    throw new Error("Config must specify at least one stream");
  }

  const seenPaths = new Set();

  config.streams.forEach((stream, index) => {
    if (!stream.input) {
      throw new Error(`Stream at index ${index} missing 'input' field`);
    }

    try {
      new URL(stream.input);
    } catch (error) {
      throw new Error(
        `Stream at index ${index} has invalid 'input' URL: ${stream.input}`
      );
    }

    if (!stream.output) {
      throw new Error(`Stream at index ${index} is missing 'output' field`);
    }

    // Ensure output paths start with /
    if (!stream.output.startsWith("/")) {
      throw new Error(
        `Stream at index ${index} 'output' must start with '/': ${stream.output}`
      );
    }

    // Check for duplicate output paths
    if (seenPaths.has(stream.output)) {
      throw new Error(
        `Duplicate output path '${stream.output}' found in config`
      );
    }
    seenPaths.add(stream.output);

    if (!stream.bitrate) {
      stream.bitrate = config.defaults?.bitrate || "128k";
    }
  });
}

export function validateEnv() {
  if (process.env.LOG_LEVEL == null) {
    process.env.LOG_LEVEL = "INFO";
  }

  if (process.env.TZ == null) {
    log("'TZ' environment variable is not set. Defaulting to 'UTC' …");
    process.env.TZ = "UTC";
  }

  if (process.env.HTTP_PORT == null) {
    log(
      "'HTTP_PORT' environment variable is not set. Setting to '3000' …",
      LOG_LEVELS.DEBUG
    );
    process.env.HTTP_PORT = "3000";
  }

  if (process.env.STREAMS_FILE) {
    // We have found a streams config file, so we skip single stream mode env vars validation
    return process.env;
  }

  if (process.env.INPUT_STREAM == null) {
    throw new Error("'INPUT_STREAM' environment variable is not set.");
  }

  try {
    new URL(process.env.INPUT_STREAM);
  } catch (error) {
    throw new Error("'INPUT_STREAM' environment variable is not a valid URL.");
  }

  if (process.env.OUTPUT_PATH == null) {
    log("'OUTPUT_PATH' environment variable is not set. Defaulting to '/' …");
    process.env.OUTPUT_PATH = "/";
  }

  if (process.env.BITRATE == null) {
    log("'BITRATE' environment variable is not set. Defaulting to '128k' …");
    process.env.BITRATE = "128k";
  }

  return process.env;
}
