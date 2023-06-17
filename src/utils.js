// @ts-check
export async function sleep(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function log(message) {
  const dateTimeStamp = new Date().toISOString();
  console.log(`${dateTimeStamp} - ${message}`);
}
