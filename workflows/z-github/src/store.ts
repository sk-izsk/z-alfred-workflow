import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { newView, type Session, type Mode } from "./model.ts";
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid window session.");
  return join(cacheDir(), `session-${id}.json`);
};
export const save = (session: Session): void => writeJson(file(session.id), session);
export const read = (id: string): Session => {
  const state = readJson<Session | null>(file(id), null);
  if (!state) throw new Error("This window session expired. Reopen GitHub.");
  return state;
};
export const create = (mode: Mode, repo = ""): Session => {
  const s: Session = {
    id: randomUUID(),
    view: newView(mode, repo),
    revision: randomUUID(),
    preview: false,
  };
  save(s);
  return s;
};
export const beginRequest = (s: Session): string => {
  s.revision = randomUUID();
  save(s);
  return s.revision;
};
export const current = (s: Session, revision: string): boolean => read(s.id).revision === revision;
