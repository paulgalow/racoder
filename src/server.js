import http from "node:http";
import { spawn } from "node:child_process";
import { getTimeZone, logger, validateEnv, loadConfig } from "./utils.js";

validateEnv();
const config = loadConfig();
const streamMap = new Map();

logger.info(`Log level set to '${process.env.LOG_LEVEL}'`);

if (config) {
  // Multi-stream mode from config file
  config.streams.forEach((stream) => {
    streamMap.set(stream.output, {
      input: stream.input,
      bitrate: stream.bitrate,
    });
  });
  logger.info(`Configured ${streamMap.size} stream(s) from config file`);
} else {
  // Single-stream mode from environment variables
  const { BITRATE, INPUT_STREAM, OUTPUT_PATH } = process.env;
  streamMap.set(OUTPUT_PATH, {
    input: INPUT_STREAM,
    bitrate: BITRATE,
  });
  logger.info("Running in single-stream mode from environment variables");
}

function handleStream(req, res, streamConfig) {
  logger.info(
    `Incoming '${req.method}' request for '${req.url}' from '${req.socket.remoteAddress}'`
  );
  logger.debug(`Incoming request headers: ${req.rawHeaders}`);
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

  logger.info(`Spawned FFmpeg process with PID '${ffmpegProcess.pid}'`);

  ffmpegProcess.stderr.on("data", (data) => {
    logger.debug(`stdout: ${data}`);
  });

  ffmpegProcess.on("data", (error) => {
    logger.error(
      `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
    );
  });

  ffmpegProcess.on("error", (error) => {
    logger.error(
      `FFmpeg process with PID '${ffmpegProcess.pid} encountered an error: ${error}`
    );
  });

  ffmpegProcess.on("close", (code) => {
    logger.info(
      `FFmpeg process with PID '${ffmpegProcess.pid}' exited with code ${code}`
    );
    res.end();
  });

  req.on("close", () => {
    logger.debug(`Quitting FFmpeg process with PID '${ffmpegProcess.pid}' …`);
    ffmpegProcess.kill();
  });
}

function handleHealthcheck(req, res) {
  logger.debug("Healthcheck probed");
  res.writeHead(200);
  res.end();
}

function handleNotFound(req, res) {
  logger.info(`404 Invalid URL: '${req.url}'`);
  res.writeHead(404);
  res.end();
}

function gracefulShutdown(signal) {
  logger.info(`${signal} received. Stopping server …`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    logger.info("Timeout reached. Shutting down server now …");
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

logger.info(`Server timezone: ${getTimeZone()}`);
server.listen(HTTP_PORT);
logger.info(`Server listening on TCP port ${HTTP_PORT} …`);

streamMap.forEach((config, path) => {
  logger.info(`Stream available at '${path}' (bitrate: ${config.bitrate})`);
});

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
