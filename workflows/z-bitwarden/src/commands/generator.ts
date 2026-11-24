import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { bw } from "../bw.ts";
import { copySecret, passwordsOffClipboard, scheduleClear } from "../clipboard.ts";
import { BUNDLE_ID, bool, num, str } from "../env.ts";
import { pressPaste, sleep, typeText } from "../keys.ts";
import { type Action, errorStatus, finish, merge, status, update, vars } from "../ui.ts";

/** Generator options; the window persists them, the quick command reads the same values. */
export type GenOptions = {
  type: "password" | "passphrase";
  length: number;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
};

export const DEFAULTS: GenOptions = {
  type: "password",
  length: 16,
  upper: true,
  lower: true,
  number: true,
  special: false,
  words: 3,
  separator: "-",
  capitalize: true,
  includeNumber: true,
};

const truthy = (v: unknown) => v === true || v === "true" || v === "1" || v === 1;

/** `bw generate` flags for these options (bw needs length ≥ 5 and ≥ 3 words). */
export const generateArgs = (o: GenOptions): string[] => {
  if (o.type === "passphrase") {
    return [
      "--passphrase",
      "--words",
      String(Math.min(Math.max(o.words, 3), 20)),
      "--separator",
      o.separator === "" ? "empty" : o.separator === " " ? "space" : o.separator,
      ...(o.capitalize ? ["--capitalize"] : []),
      ...(o.includeNumber ? ["--includeNumber"] : []),
    ];
  }
  const sets = [o.upper && "-u", o.lower && "-l", o.number && "-n", o.special && "-s"].filter(
    Boolean,
  ) as string[];
  return [...(sets.length ? sets : ["-l"]), "--length", String(Math.min(Math.max(o.length, 5), 128))];
};

const SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  number: "0123456789",
  special: "!@#$%^&*",
} as const;

/**
 * Passwords are made right here (instant, `crypto.randomInt`), with at least one character
 * from every chosen set, like Bitwarden. Passphrases need Bitwarden's word list, so use bw.
 */
const pickChar = (chars: string): string => chars[randomInt(chars.length)]!;

export const localPassword = (o: GenOptions): string => {
  const chosen = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]);
  const sets = (chosen.length ? chosen : (["lower"] as const)).map((k) => SETS[k]);
  const length = Math.min(Math.max(o.length, 5), 128);
  const all = sets.join("");
  const chars = [...sets.map(pickChar), ...Array.from({ length: length - sets.length }, () => pickChar(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
};

export const generate = async (o: GenOptions): Promise<string> =>
  o.type === "password" ? localPassword(o) : bw(["generate", ...generateArgs(o)]);

/** Options the window saved (Alfred keeps persisted UI variables in this file). */
export const savedOptions = (): GenOptions => {
  const file = join(
    homedir(),
    "Library/Application Support/Alfred/AlfredUI/Persist",
    BUNDLE_ID,
    "variables.json",
  );
  try {
    const saved = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    return fromRecord((k) => saved[`gen_${k}`]);
  } catch {
    return DEFAULTS;
  }
};

const fromRecord = (get: (key: string) => unknown): GenOptions => {
  const pick = <K extends keyof GenOptions>(key: K, parse: (v: unknown) => GenOptions[K]): GenOptions[K] => {
    const value = get(key);
    return value === undefined || value === "" ? DEFAULTS[key] : parse(value);
  };
  return {
    type: pick("type", (v) => (v === "passphrase" ? "passphrase" : "password")),
    length: pick("length", (v) => Number(v) || DEFAULTS.length),
    upper: pick("upper", truthy),
    lower: pick("lower", truthy),
    number: pick("number", truthy),
    special: pick("special", truthy),
    words: pick("words", (v) => Number(v) || DEFAULTS.words),
    separator: pick("separator", String),
    capitalize: pick("capitalize", truthy),
    includeNumber: pick("includeNumber", truthy),
  };
};

const ARG_KEYS: (keyof GenOptions)[] = [
  "type",
  "length",
  "upper",
  "lower",
  "number",
  "special",
  "words",
  "separator",
  "capitalize",
  "includeNumber",
];

/** Window: any option changed → new password + save the options. */
export const genCommand = async (args: string[]): Promise<Action> => {
  const options = fromRecord((key) => args[ARG_KEYS.indexOf(key as keyof GenOptions)]);
  try {
    const value = await generate(options);
    const passphrase = options.type === "passphrase";
    return merge(
      vars({ generated: value, ...Object.fromEntries(ARG_KEYS.map((k) => [`gen_${k}`, options[k]])) }),
      update({
        preview: { text: value },
        passwordOptions: { hidden: passphrase },
        passphraseOptions: { hidden: !passphrase },
      }),
      status(`${value.length} characters`),
    );
  } catch (error) {
    return errorStatus(error);
  }
};

export const genCopy = async ([mode = "copy"]: string[]): Promise<Action> => {
  const value = str("generated");
  if (!value) return status("Nothing generated yet", "systemOrangeColor");
  if (passwordsOffClipboard()) {
    return mode === "paste"
      ? finish({ bw_out: "type", type_generated: "1", type_value: value })
      : status("Copying passwords is turned off (Workflow Configuration)", "systemOrangeColor");
  }
  const count = await copySecret(value);
  if (mode === "paste") return finish({ bw_out: "paste", bw_cc: String(count) });
  scheduleClear(count, num("clipboard_clear", 60));
  return bool("close_on_copy", true) ? finish() : status("Copied password");
};

/** Keyword "Generate Password (Quick)": no window, copy (and paste) with the saved options. */
export const genQuick = async (): Promise<void> => {
  const value = await generate(savedOptions());
  if (passwordsOffClipboard()) {
    if (!bool("quick_paste", true))
      throw new Error("Copying passwords is turned off (Workflow Configuration)");
    await sleep(250);
    await typeText(value);
    return;
  }
  const count = await copySecret(value);
  scheduleClear(count, num("clipboard_clear", 60)); // armed before the paste, which can fail
  if (bool("quick_paste", true)) {
    await sleep(250);
    await pressPaste();
  }
  process.stdout.write(bool("quick_paste", true) ? "" : "Password copied");
};
