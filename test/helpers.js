/**
 * Test helpers and utilities
 */

import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";

/**
 * Wait for a specific amount of time
 * @param {number} ms - Milliseconds to wait
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start a server process with given environment variables
 * @param {Object} env - Environment variables
 * @param {number} port - Port number
 * @returns {Promise<{process: ChildProcess, getOutput: () => string}>}
 */
export function startTestServer(env = {}, port = 13000) {
  let capturedOutput = "";

  return new Promise((resolve, reject) => {
    const serverProcess = spawn("node", ["src/server.js"], {
      env: {
        ...process.env,
        HTTP_PORT: port.toString(),
        LOG_LEVEL: "INFO",
        ...env,
      },
      cwd: process.cwd(),
    });

    const onData = (data) => {
      capturedOutput += data.toString();
      if (capturedOutput.includes(`Server listening on TCP port ${port}`)) {
        waitForServer(`http://localhost:${port}`)
          .then(() => {
            resolve({
              process: serverProcess,
              getOutput: () => capturedOutput,
            });
          })
          .catch((error) => {
            serverProcess.kill();
            reject(error);
          });
      }
    };

    serverProcess.stdout.on("data", onData);
    serverProcess.stderr.on("data", onData);

    serverProcess.on("error", (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(
          new Error(
            `Server exited with code ${code}\nOutput: ${capturedOutput}`
          )
        );
      }
    });

    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill();
        reject(new Error("Server failed to start within timeout"));
      }
    }, 10000);
  });
}

/**
 * Stop a server process gracefully
 * @param {ChildProcess} serverProcess
 * @returns {Promise<void>}
 */
export function stopTestServer(serverProcess) {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.killed) {
      resolve();
      return;
    }

    serverProcess.on("exit", () => {
      resolve();
    });

    serverProcess.kill("SIGTERM");

    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
      resolve();
    }, 5000);
  });
}

/**
 * Make an HTTP request to a test server
 * @param {string} url - Full URL to request
 * @param {Object} options - Request options
 * @returns {Promise<{statusCode: number, headers: Object, body: Buffer}>}
 */
export function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        ...options,
      },
      (res) => {
        let data = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(data),
          });
        });
      }
    );

    req.on("error", reject);

    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    }

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Test if a stream endpoint starts responding
 * @param {string} url - Stream URL to test
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export function testStreamStarts(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "GET" });

    req.on("response", (res) => {
      if (
        res.statusCode === 200 &&
        res.headers["content-type"] === "audio/mpeg"
      ) {
        req.destroy();
        resolve(true);
      } else {
        req.destroy();
        resolve(false);
      }
    });

    req.on("error", (err) => {
      if ("code" in err && err.code === "ECONNRESET") {
        resolve(true);
      } else {
        reject(err);
      }
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

/**
 * Wait for a server to be ready by polling the healthcheck endpoint
 * @param {string} baseUrl - Base URL of the server
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} interval - Interval between attempts in ms
 * @returns {Promise<boolean>}
 */
export async function waitForServer(baseUrl, maxAttempts = 20, interval = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await makeHttpRequest(`${baseUrl}/healthcheck`, {
        timeout: 1000,
      });
      if (response.statusCode === 200) {
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    await sleep(interval);
  }
  throw new Error(`Server did not become ready after ${maxAttempts} attempts`);
}