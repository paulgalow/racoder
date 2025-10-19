import http from "node:http";
import { spawn } from "node:child_process";
import {
  getTimeZone,
  log,
  LOG_LEVELS,
  validateEnv,
  loadConfig,
} from "./utils.js";

validateEnv();
const config = loadConfig();

const streamMap = new Map();

if (config) {
  // Multi-stream mode from config file
  config.streams.forEach((stream) => {
    streamMap.set(stream.output, {
      input: stream.input,
      bitrate: stream.bitrate,
    });
  });
  log(`Configured ${streamMap.size} stream(s) from config file`);
} else {
  // Single-stream mode from environment variables
  const { BITRATE, INPUT_STREAM, OUTPUT_PATH } = process.env;
  streamMap.set(OUTPUT_PATH, {
    input: INPUT_STREAM,
    bitrate: BITRATE,
  });
  log("Running in single-stream mode from environment variables");
}

function handleStream(req, res, streamConfig) {
  log(`Incoming request for URL '${req.url}' with method '${req.method}'`);
  log(`Incoming request headers: ${req.rawHeaders}`, LOG_LEVELS.DEBUG);
  res.writeHead(200, { "Content-Type": "audio/mpeg" });

  const ffmpegProcess = spawn("ffmpeg", [
    "-nostdin",
    "-loglevel",
    "warning",
    "-re",
    "-i",
    streamConfig.input,
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    streamConfig.bitrate,
    "-f",
    "mp3",
    "pipe:1",
  ]);
  ffmpegProcess.stdout.pipe(res);

  log(`Spawned FFmpeg process with PID '${ffmpegProcess.pid}'`);

  ffmpegProcess.stderr.on("data", (data) => {
    log(`stdout: ${data}`, LOG_LEVELS.DEBUG);
  });

  ffmpegProcess.on("data", (error) => {
    log(
      `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
    );
  });

  ffmpegProcess.on("error", (error) => {
    log(
      `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
    );
  });

  ffmpegProcess.on("close", (code) => {
    log(
      `FFmpeg process with PID '${ffmpegProcess.pid}' exited with code ${code}`
    );
    res.end();
  });

  req.on("close", () => {
    log(
      `Quitting FFmpeg process with PID '${ffmpegProcess.pid}' …`,
      LOG_LEVELS.DEBUG
    );
    ffmpegProcess.kill();
  });
}

function handleHealthcheck(req, res) {
  log("Healthcheck probed", LOG_LEVELS.DEBUG);
  res.writeHead(200);
  res.end();
}

function handleNotFound(req, res) {
  log(`404 Invalid URL: '${req.url}'`);
  res.writeHead(404);
  res.end();
}

function gracefulShutdown(signal) {
  log(`${signal} received. Stopping server …`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    log("Timeout reached. Shutting down server now …");
    process.exit(1);
  }, 5000);
}

const server = http.createServer(
  { keepAlive: true, keepAliveInitialDelay: 5000 },
  (req, res) => {
    const normalizedUrl =
      req.url.endsWith("/") && req.url.length > 1
        ? req.url.slice(0, -1)
        : req.url;

    if (normalizedUrl === "/healthcheck") {
      handleHealthcheck(req, res);
      return;
    }

    const streamConfig = streamMap.get(normalizedUrl);

    if (streamConfig) {
      handleStream(req, res, streamConfig);
    } else {
      handleNotFound(req, res);
    }
  }
);

const { HTTP_PORT } = process.env;

log(`Server timezone: ${getTimeZone()}`);
server.listen(HTTP_PORT);
log(`Server listening on TCP port ${HTTP_PORT} …`);

streamMap.forEach((config, path) => {
  log(`Stream available at '${path}' (bitrate: ${config.bitrate})`);
});

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
