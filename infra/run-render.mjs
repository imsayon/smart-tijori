import { spawn } from "node:child_process";

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "client", "-H", "0.0.0.0"], { stdio: "inherit" });
let worker;
let retry;
let stopping = false;

function stop(signal) {
  stopping = true;
  clearTimeout(retry);
  next.kill(signal);
  worker?.kill(signal);
}

function startWorker() {
  worker = spawn(process.execPath, ["--conditions=react-server", "server/run-worker.ts"], { stdio: "inherit" });
  worker.once("error", () => console.error("Could not launch the projection worker."));
  worker.once("close", () => {
    if (stopping) return;
    console.error("Projection worker stopped. Retrying in 5 seconds.");
    retry = setTimeout(startWorker, 5_000);
  });
}

next.once("error", () => console.error("Could not launch Next.js."));
next.once("close", (code) => {
  if (!stopping) process.exitCode = code || 1;
  stop("SIGTERM");
});
process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));
startWorker();
