import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Editor, editor } from "./editors.ts";
import { readJson, str } from "./env.ts";
import { recents } from "./projects.ts";

export const DEFAULT_PROFILE = "__default__profile__";

export type Profile = {
  /** VS Code's profile location id, or DEFAULT_PROFILE. */
  id: string;
  name: string;
  settingsPath: string;
  /** extensions.json listing what's installed for this profile. */
  manifestPath: string;
};

type Stored = {
  userDataProfiles?: { location: string; name: string; useDefaultFlags?: Record<string, boolean> }[];
  profileAssociations?: { workspaces?: Record<string, string> };
};

const userDir = (e: Editor) => join(homedir(), "Library/Application Support", e.dataDir, "User");
const storage = (e: Editor): Stored =>
  readJson<Stored>(join(userDir(e), "globalStorage", "storage.json"), {});
export const defaultManifest = (e: Editor = editor()) =>
  join(homedir(), `.${e.extDir}`, "extensions", "extensions.json");

/** Default first, then the user's profiles. A profile sharing settings/extensions points at the default files. */
export const profiles = (e: Editor = editor()): Profile[] => {
  if (e.kind === "zed") return [];
  const user = userDir(e);
  const base: Profile = {
    id: DEFAULT_PROFILE,
    name: "Default",
    settingsPath: join(user, "settings.json"),
    manifestPath: defaultManifest(e),
  };
  return [
    base,
    ...(storage(e).userDataProfiles ?? []).map((p) => {
      const dir = join(user, "profiles", p.location);
      const own = (file: string) => existsSync(join(dir, file));
      return {
        id: p.location,
        name: p.name,
        settingsPath:
          p.useDefaultFlags?.settings || !own("settings.json")
            ? base.settingsPath
            : join(dir, "settings.json"),
        manifestPath:
          p.useDefaultFlags?.extensions || !own("extensions.json")
            ? base.manifestPath
            : join(dir, "extensions.json"),
      };
    }),
  ];
};

export const profileById = (id: string, e: Editor = editor()): Profile =>
  profiles(e).find((p) => p.id === id) ?? profiles(e)[0]!;

/** The profile of the most recently opened project: VS Code has no global "current" profile. */
export const recentProfile = (recentUris: string[], e: Editor = editor()): string => {
  const map = storage(e).profileAssociations?.workspaces ?? {};
  for (const uri of recentUris) if (map[uri]) return map[uri]!;
  return DEFAULT_PROFILE;
};

/**
 * The profile themes and extensions work on: "VS Code Profile" in the Workflow Configuration
 * (a profile name), or, when blank or unknown, the profile of the most recently opened project.
 */
export const configuredProfile = async (e: Editor = editor()): Promise<Profile> => {
  const wanted = str("profile").toLowerCase();
  const all = profiles(e);
  const named = wanted && all.find((p) => p.name.toLowerCase() === wanted);
  return (
    named ||
    profileById(
      recentProfile(
        (await recents(e)).map((p) => p.uri),
        e,
      ),
      e,
    )
  );
};
