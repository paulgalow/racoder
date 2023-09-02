export function log(message) {
  const dateTimeStamp = new Date().toISOString();
  console.log(`${dateTimeStamp} - ${message}`);
}
