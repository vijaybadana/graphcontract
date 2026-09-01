import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const schema = "portal-operator-result-v1";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(scriptDirectory, "..");
const runtimeRoot = path.join(repository, ".graphcontract-runtime");
const defaultRunId = "graphcontract-local";
const defaultHost = "127.0.0.1";
const defaultPort = 3000;
const sourceDirectories = ["app", "components", "lib", "public", "src"];
const sourceFiles = [
  ".openai/hosting.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
];

const startedAt = Date.now();
const [action = "status", ...rawArguments] = process.argv.slice(2);
const argumentsByName = parseArguments(rawArguments);
const runId = sanitizeRunId(argumentsByName["run-id"] ?? defaultRunId);
const host = defaultHost;
const port = parsePort(argumentsByName.port ?? defaultPort);
const runDirectory = path.join(runtimeRoot, runId);
const statePath = path.join(runDirectory, "runtime.json");
const buildPath = path.join(runDirectory, "build.json");
const logPath = path.join(runDirectory, "runtime.log");
const url = `http://${host}:${port}`;

mkdirSync(runDirectory, { recursive: true });

try {
  const effective = await executeAction(action);
  emitResult({ action, success: true, effective });
} catch (error) {
  const failure = normalizeFailure(error);
  emitResult({
    action,
    success: false,
    effective: failure.effective ?? { status: "blocked", url, host, port },
    blocker: failure.message,
    repairCommand: failure.repairCommand,
  });
  process.exitCode = 1;
}

async function executeAction(requestedAction) {
  switch (requestedAction) {
    case "setup":
      return buildApplication({ force: false });
    case "run":
    case "reload":
      return ensureRunning({ forceRestart: false });
    case "restart":
      return ensureRunning({ forceRestart: true });
    case "status":
      return readStatus();
    case "stop":
      return stopRuntime();
    default:
      throw failure(
        `Unknown local runtime action: ${requestedAction}`,
        "Use one of setup, run, status, reload, restart, or stop.",
      );
  }
}

async function ensureRunning({ forceRestart }) {
  const signature = calculateSourceSignature();
  const state = readJson(statePath);
  const ownedProcessRunning = state && isOwnedProcess(state);
  const health = ownedProcessRunning ? await checkApplication(state.url) : null;

  if (
    !forceRestart &&
    health?.healthy &&
    state.sourceSignature === signature &&
    state.host === host &&
    state.port === port
  ) {
    return {
      status: "ready",
      url,
      host,
      port,
      pid: state.pid,
      assetsVerified: health.assetsVerified,
      reused: true,
      sourceSignature: signature,
      logPath,
    };
  }

  await buildApplication({ force: forceRestart, signature });

  if (ownedProcessRunning) {
    await terminateOwnedProcess(state);
  } else if (await isPortListening(host, port)) {
    throw failure(
      `Port ${port} is already occupied by a process this runtime does not own. Nothing was stopped.`,
      `Stop that process or run: npm run local:run -- --run-id ${runId} --port ${port + 1}`,
    );
  }

  const pid = startRuntimeProcess();
  const nextState = {
    schema,
    runId,
    pid,
    host,
    port,
    url,
    repository,
    sourceSignature: signature,
    startedAt: new Date().toISOString(),
  };
  writeJson(statePath, nextState);

  try {
    const ready = await waitForApplication(url, pid);
    return {
      status: "ready",
      url,
      host,
      port,
      pid,
      assetsVerified: ready.assetsVerified,
      reused: false,
      sourceSignature: signature,
      logPath,
    };
  } catch (error) {
    if (isProcessAlive(pid)) {
      await terminateOwnedProcess(nextState);
    }
    rmSync(statePath, { force: true });
    throw error;
  }
}

async function buildApplication({ force, signature = calculateSourceSignature() }) {
  const buildState = readJson(buildPath);
  const outputExists = existsSync(path.join(repository, "dist", "server", "index.js"));

  if (!force && outputExists && buildState?.sourceSignature === signature) {
    return {
      status: "built",
      reused: true,
      sourceSignature: signature,
      logPath,
    };
  }

  appendLog(`\n[${new Date().toISOString()}] npm run build\n`);
  const logDescriptor = openSync(logPath, "a");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npm, ["run", "build"], {
    cwd: repository,
    env: process.env,
    stdio: ["ignore", logDescriptor, logDescriptor],
  });
  closeSync(logDescriptor);

  if (build.status !== 0 || !existsSync(path.join(repository, "dist", "server", "index.js"))) {
    throw failure(
      `The production build failed. See ${logPath}.`,
      `Review the log, fix the build, then run: npm run local:run -- --run-id ${runId}`,
    );
  }

  writeJson(buildPath, {
    schema,
    sourceSignature: signature,
    builtAt: new Date().toISOString(),
  });

  return {
    status: "built",
    reused: false,
    sourceSignature: signature,
    logPath,
  };
}

async function readStatus() {
  const state = readJson(statePath);
  if (!state || !isOwnedProcess(state)) {
    const occupied = await isPortListening(host, port);
    return {
      status: occupied ? "occupied-unmanaged" : "stopped",
      url,
      host,
      port,
      owned: false,
      logPath,
    };
  }

  const health = await checkApplication(state.url);
  return {
    status: health.healthy ? "ready" : "unhealthy",
    url: state.url,
    host: state.host,
    port: state.port,
    pid: state.pid,
    owned: true,
    assetsVerified: health.assetsVerified,
    sourceSignature: state.sourceSignature,
    logPath,
  };
}

async function stopRuntime() {
  const state = readJson(statePath);
  if (!state || !isOwnedProcess(state)) {
    rmSync(statePath, { force: true });
    return { status: "stopped", url, host, port, owned: false, logPath };
  }

  await terminateOwnedProcess(state);
  rmSync(statePath, { force: true });
  return {
    status: "stopped",
    url: state.url,
    host: state.host,
    port: state.port,
    pid: state.pid,
    owned: true,
    logPath,
  };
}

function startRuntimeProcess() {
  appendLog(`\n[${new Date().toISOString()}] npm run start -- --hostname ${host} --port ${port}\n`);
  const logDescriptor = openSync(logPath, "a");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npm,
    ["run", "start", "--", "--hostname", host, "--port", String(port)],
    {
      cwd: repository,
      detached: true,
      env: process.env,
      stdio: ["ignore", logDescriptor, logDescriptor],
    },
  );
  closeSync(logDescriptor);
  child.unref();
  return child.pid;
}

async function waitForApplication(applicationUrl, pid) {
  const deadline = Date.now() + 25_000;
  let lastReason = "The server has not responded yet.";

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      throw failure(
        `The local server exited before it became ready. See ${logPath}.`,
        `Review the log, then run: npm run local:run -- --run-id ${runId}`,
      );
    }
    const health = await checkApplication(applicationUrl);
    if (health.healthy) return health;
    lastReason = health.reason;
    await delay(250);
  }

  throw failure(
    `The local server did not become ready: ${lastReason} See ${logPath}.`,
    `Review the log, then run: npm run local:restart -- --run-id ${runId}`,
  );
}

async function checkApplication(applicationUrl) {
  try {
    const response = await fetch(`${applicationUrl}/?runtime=health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return { healthy: false, reason: `The page returned HTTP ${response.status}.`, assetsVerified: 0 };
    }

    const html = await response.text();
    if (!html.includes("GraphContract")) {
      return { healthy: false, reason: "The page is not the GraphContract application.", assetsVerified: 0 };
    }

    const assetUrls = extractAssetUrls(html, applicationUrl);
    if (assetUrls.length === 0) {
      return { healthy: false, reason: "The page did not reference any JavaScript or CSS assets.", assetsVerified: 0 };
    }

    for (const assetUrl of assetUrls) {
      const asset = await fetch(assetUrl, { cache: "no-store", signal: AbortSignal.timeout(3_000) });
      if (!asset.ok) {
        return {
          healthy: false,
          reason: `Asset ${assetUrl} returned HTTP ${asset.status}.`,
          assetsVerified: 0,
        };
      }
      const body = await asset.arrayBuffer();
      if (body.byteLength === 0) {
        return { healthy: false, reason: `Asset ${assetUrl} was empty.`, assetsVerified: 0 };
      }
    }

    return { healthy: true, reason: null, assetsVerified: assetUrls.length };
  } catch (error) {
    return { healthy: false, reason: error instanceof Error ? error.message : String(error), assetsVerified: 0 };
  }
}

function extractAssetUrls(html, applicationUrl) {
  const matches = html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/giu);
  return [...new Set([...matches].map((match) => new URL(match[1], applicationUrl).href))];
}

function calculateSourceSignature() {
  const hash = createHash("sha256");
  const paths = [];

  for (const directory of sourceDirectories) {
    const absoluteDirectory = path.join(repository, directory);
    if (existsSync(absoluteDirectory)) collectFiles(absoluteDirectory, paths);
  }
  for (const file of sourceFiles) {
    const absoluteFile = path.join(repository, file);
    if (existsSync(absoluteFile) && statSync(absoluteFile).isFile()) paths.push(absoluteFile);
  }

  paths.sort();
  for (const absoluteFile of paths) {
    hash.update(path.relative(repository, absoluteFile));
    hash.update("\0");
    hash.update(readFileSync(absoluteFile));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function collectFiles(directory, output) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolutePath, output);
    else if (entry.isFile()) output.push(absolutePath);
  }
}

function isOwnedProcess(state) {
  if (!Number.isInteger(state?.pid) || !isProcessAlive(state.pid)) return false;
  const command = spawnSync("ps", ["-p", String(state.pid), "-o", "command="], { encoding: "utf8" });
  if (command.status !== 0) return false;
  return /npm run start|vinext start/u.test(command.stdout);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateOwnedProcess(state) {
  if (!isOwnedProcess(state)) return;
  try {
    process.kill(-state.pid, "SIGTERM");
  } catch {
    process.kill(state.pid, "SIGTERM");
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && isProcessAlive(state.pid)) await delay(100);
  if (isProcessAlive(state.pid)) {
    throw failure(
      `Owned runtime PID ${state.pid} did not stop after SIGTERM.`,
      `Inspect ${logPath} and stop PID ${state.pid} before retrying.`,
    );
  }
}

function isPortListening(portHost, portNumber) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: portHost, port: portNumber });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function parseArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    const [name, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) parsed[name] = inlineValue;
    else if (values[index + 1] && !values[index + 1].startsWith("--")) parsed[name] = values[++index];
    else parsed[name] = true;
  }
  return parsed;
}

function parsePort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw failure(`Invalid port: ${value}`, "Choose a port between 1 and 65535.");
  }
  return parsed;
}

function sanitizeRunId(value) {
  const sanitized = String(value).trim().replace(/[^a-zA-Z0-9._-]/gu, "-");
  if (!sanitized) throw failure("The run ID cannot be empty.", `Use --run-id ${defaultRunId}.`);
  return sanitized;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function appendLog(message) {
  appendFileSync(logPath, message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function failure(message, repairCommand, effective) {
  const error = new Error(message);
  error.repairCommand = repairCommand;
  error.effective = effective;
  return error;
}

function normalizeFailure(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      repairCommand: error.repairCommand ?? null,
      effective: error.effective ?? null,
    };
  }
  return { message: String(error), repairCommand: null, effective: null };
}

function emitResult({ action: resultAction, success, effective, blocker = null, repairCommand = null }) {
  process.stdout.write(
    `${JSON.stringify({
      schema,
      action: resultAction,
      runId,
      target: { repository },
      success,
      effective,
      elapsedMs: Date.now() - startedAt,
      blocker,
      repairCommand,
    })}\n`,
  );
}
