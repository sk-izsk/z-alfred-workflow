import { expect, test } from "bun:test";
import { join } from "node:path";

/** Run publicEnv() in a real child process, so the variables are genuinely inherited. */
const childEnv = (inherited: Record<string, string>): Record<string, string | undefined> => {
  const script = `import { publicEnv } from ${JSON.stringify(join(import.meta.dir, "../src/proc.ts"))}; console.log(JSON.stringify(publicEnv()));`;
  const out = Bun.spawnSync([process.execPath, "-e", script], { env: inherited });
  return JSON.parse(out.stdout.toString());
};

test("child environment is an allow-list: only known-safe variables get through", () => {
  const env = childEnv({
    PATH: "/usr/bin",
    HOME: "/Users/x",
    LANG: "en_US.UTF-8",
    HTTPS_PROXY: "http://proxy:8080",
    no_proxy: "localhost",
    SSL_CERT_FILE: "/certs.pem",
    alfred_workflow_data: "/data",
    // none of these may reach a child
    SOME_NEW_SECRET: "x",
    AWS_SECRET_ACCESS_KEY: "x",
    GITHUB_TOKEN: "x",
    secret_input: "x",
    fill_p: "x",
    BW_SESSION: "x",
    NODE_OPTIONS: "--no-warnings", // harmless here, but a real injection vector
    DYLD_FALLBACK_LIBRARY_PATH: "/usr/lib",
  });
  expect(env.PATH).toBe("/usr/bin");
  expect(env.HOME).toBe("/Users/x");
  expect(env.LANG).toBe("en_US.UTF-8");
  expect(env.HTTPS_PROXY).toBe("http://proxy:8080");
  expect(env.no_proxy).toBe("localhost");
  expect(env.SSL_CERT_FILE).toBe("/certs.pem");
  expect(env.alfred_workflow_data).toBe("/data");
  for (const key of [
    "SOME_NEW_SECRET",
    "AWS_SECRET_ACCESS_KEY",
    "GITHUB_TOKEN",
    "secret_input",
    "fill_p",
    "BW_SESSION",
    "NODE_OPTIONS",
    "DYLD_FALLBACK_LIBRARY_PATH",
  ])
    expect(env[key]).toBeUndefined();
});
