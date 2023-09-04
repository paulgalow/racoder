export function log(message) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateTimeStamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  console.log(`${dateTimeStamp} - ${message}`);
}

export function getTimeZone() {
  const now = new Date();
  return Intl.DateTimeFormat("en", { timeZoneName: "short" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName").value;
}

export function validateEnv() {
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

  if (process.env.TZ == null) {
    log("'TZ' environment variable is not set. Defaulting to 'UTC' …");
    process.env.TZ = "UTC";
  }

  if (process.env.HTTP_PORT == null) {
    log("'HTTP_PORT' environment variable is not set. Setting to '3000' …");
    process.env.HTTP_PORT = "3000";
  }

  return process.env;
}
