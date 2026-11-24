import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { str } from "./env.ts";

/** VS Code forks share one layout; Zed has its own (no Marketplace, different recents DB). */
export type Editor = {
  id: string;
  title: string;
  app: string;
  /** CLI inside the app bundle, relative to `Contents/`. */
  cli: string;
  kind: "vscode" | "zed";
  /** `~/Library/Application Support/<dataDir>` */
  dataDir: string;
  /** `~/.<extDir>/extensions` and the `<extDir>:extension/<id>` URL scheme. */
  extDir: string;
};

const fork = (id: string, title: string, app: string, bin: string, extDir: string, dataDir = id): Editor => ({
  id,
  title,
  app,
  cli: `Resources/app/bin/${bin}`,
  kind: "vscode",
  dataDir,
  extDir,
});

export const EDITORS: Editor[] = [
  fork("Code", "Visual Studio Code", "Visual Studio Code.app", "code", "vscode"),
  fork(
    "Code - Insiders",
    "Visual Studio Code - Insiders",
    "Visual Studio Code - Insiders.app",
    "code",
    "vscode-insiders",
  ),
  fork("Cursor", "Cursor", "Cursor.app", "cursor", "cursor"),
  fork("Windsurf", "Windsurf", "Windsurf.app", "windsurf", "windsurf"),
  fork("VSCodium", "VSCodium", "VSCodium.app", "codium", "vscode-oss"),
  fork(
    "VSCodium - Insiders",
    "VSCodium - Insiders",
    "VSCodium - Insiders.app",
    "codium-insiders",
    "vscode-oss-insiders",
  ),
  fork("Antigravity IDE", "Antigravity IDE", "Antigravity IDE.app", "antigravity-ide", "antigravity-ide"),
  fork("Kiro", "Kiro", "Kiro.app", "kiro", "kiro"),
  fork("Positron", "Positron", "Positron.app", "code", "positron"),
  fork("Trae", "Trae", "Trae.app", "marscode", "trae"),
  fork("Trae CN", "Trae CN", "Trae CN.app", "marscode", "trae-cn"),
  fork("Qoder", "Qoder", "Qoder.app", "code", "qoder"),
  fork("Devin", "Devin", "Devin.app", "devin-desktop", "devin"),
  fork("Lingma", "Lingma", "Lingma.app", "code", "lingma"),
  fork("IBM Bob", "IBM Bob", "IBM Bob.app", "bobide", "bobide"),
  { id: "Zed", title: "Zed", app: "Zed.app", cli: "MacOS/cli", kind: "zed", dataDir: "Zed", extDir: "" },
  {
    id: "Zed Preview",
    title: "Zed Preview",
    app: "Zed Preview.app",
    cli: "MacOS/cli",
    kind: "zed",
    dataDir: "Zed",
    extDir: "",
  },
];

/** The editor picked in the Workflow Configuration (Visual Studio Code by default). */
export const editor = (): Editor => EDITORS.find((e) => e.id === str("editor")) ?? EDITORS[0]!;

/** `/Applications/X.app`, falling back to `~/Applications/X.app`. */
export const appPath = (e: Editor = editor()): string => {
  const candidates = [join("/Applications", e.app), join(homedir(), "Applications", e.app)];
  return candidates.find(existsSync) ?? candidates[0]!;
};

export const cliPath = (e: Editor = editor()): string => join(appPath(e), "Contents", e.cli);

/** Short name for menus: "Code", "Cursor", "Zed". */
export const shortName = (e: Editor = editor()): string => (e.id === "Code" ? "Code" : e.title);

type Product = {
  sharedDataFolderName?: string;
  extensionsGallery?: { serviceUrl?: string; itemUrl?: string };
};

/** The app's own product.json (shared data folder, marketplace URLs). */
export const product = (e: Editor = editor()): Product => {
  try {
    return JSON.parse(
      readFileSync(join(appPath(e), "Contents/Resources/app/product.json"), "utf8"),
    ) as Product;
  } catch {
    return {};
  }
};
