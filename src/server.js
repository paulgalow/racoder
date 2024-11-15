import http from "node:http";
import { spawn } from "node:child_process";
import { getTimeZone, log, LOG_LEVELS, validateEnv } from "./utils.js";

const { BITRATE, HTTP_PORT, INPUT_STREAM, OUTPUT_PATH } = validateEnv();

const INPUT_STREAMS = INPUT_STREAM.split("|");
const OUTPUT_PATHS = OUTPUT_PATH.split("|");

function trim_trailing_slash(val) {
    if (val.length > 1 && val[val.length - 1] == "/") {
        val = val.slice(0, -1);
    }
    return val;
}

var STREAMS = {};
OUTPUT_PATHS.forEach((element, index) => {
    STREAMS[element] = trim_trailing_slash(INPUT_STREAMS[index]);
});

function handleStream(req, res) {
  log(`Incoming request for URL '${req.url}' with method '${req.method}'`);
  log(`Incoming request headers: ${req.rawHeaders}`, LOG_LEVELS.DEBUG);
  res.writeHead(200, { "Content-Type": "audio/mpeg" });
  const stream_url = STREAMS[trim_trailing_slash(req.url)];

  const ffmpegProcess = spawn("ffmpeg", [
    "-nostdin",
    "-loglevel",
    "warning",
    "-re",
    "-i",
    stream_url,
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    BITRATE,
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
    const req_url = trim_trailing_slash(req.url);
    if (req_url in STREAMS) {
        handleStream(req, res);
    } else if (req_url == "/healthcheck") {
        handleHealthcheck(req, res);
    } else {
        handleNotFound(req, res);
    }
  }
);

log(`Server timezone: ${getTimeZone()}`);
server.listen(HTTP_PORT);
log(`Server listening on TCP port ${HTTP_PORT} …`);
log(`Stream available at '${OUTPUT_PATH}'`);

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
