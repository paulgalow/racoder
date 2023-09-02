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
