import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

if (process.platform === "darwin") {
  const require = createRequire(import.meta.url);
  const headers = require("node-api-headers").include_dir;
  mkdirSync("dist-electron", { recursive: true });
  execFileSync(
    "/usr/bin/xcrun",
    [
      "clang++",
      "-std=c++17",
      "-fobjc-arc",
      "-DNAPI_VERSION=8",
      "-DNODE_GYP_MODULE_NAME=noteboard_keychain",
      "-bundle",
      "-undefined",
      "dynamic_lookup",
      "-mmacosx-version-min=12.0",
      "-I",
      headers,
      "-framework",
      "Foundation",
      "-framework",
      "Security",
      "-framework",
      "LocalAuthentication",
      "electron/native/keychain.mm",
      "-o",
      path.resolve("dist-electron/noteboard-keychain.node"),
    ],
    { stdio: "inherit" },
  );
}
