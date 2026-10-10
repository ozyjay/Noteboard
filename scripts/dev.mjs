import "./build-electron.mjs";
import { spawn } from "node:child_process";
import electron from "electron";
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
  { stdio: "inherit" },
);
let desktop;
const stop = () => {
  desktop?.kill();
  vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5173")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Vite did not start");
  const env = { ...process.env, INQUIRY_DEV: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = spawn(electron, ["."], {
    stdio: "inherit",
    env,
  });
  desktop.on("exit", () => {
    vite.kill();
  });
} catch (error) {
  stop();
  console.error(error.message);
  process.exitCode = 1;
}
