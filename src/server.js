// @ts-check
import http from "node:http";
import { spawn } from "node:child_process";
import { log } from "./utils.js";

const { HTTP_PORT, INPUT_STREAM } = process.env;

function handleBbcRadio4Extra(req, res) {
  res.writeHead(200, { "Content-Type": "audio/mpeg" });

  const ffmpegProcess = spawn("ffmpeg", [
    "-i",
    INPUT_STREAM,
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-f",
    "mp3",
    "pipe:1",
  ]);
  log(`Spawned FFmpeg process with PID '${ffmpegProcess.pid}'`);

  ffmpegProcess.on("spawn", () => {
    ffmpegProcess.stdout.pipe(res);
  });

  ffmpegProcess.on("close", (code) => {
    log(
      `FFmpeg process with PID '${ffmpegProcess.pid}' exited with code ${code}`
    );
    res.end();
  });

  req.on("close", () => {
    log(`Quitting FFmpeg process with PID '${ffmpegProcess.pid}' …`);
    ffmpegProcess.kill();
  });
}

function handleHealthcheck(req, res) {
  log("Healthcheck probed");
  res.writeHead(200);
  res.end();
}

function handleNotFound(req, res) {
  log(`404 Invalid URL: '${req.url}'`);
  res.writeHead(404);
  res.end();
}

const server = http.createServer((req, res) => {
  switch (req.url) {
    case "/bbc-radio-4-extra":
      handleBbcRadio4Extra(req, res);
      break;
    case "/healthcheck":
      handleHealthcheck(req, res);
      break;
    default:
      handleNotFound(req, res);
      break;
  }
});

server.listen(HTTP_PORT ?? 3000);

process.on("SIGINT", async () => {
  log("Stopping server …");
  server.close(() => {
    process.exit(0);
  });
});
