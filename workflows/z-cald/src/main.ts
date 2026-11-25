import { back, contextFor, decodeContext, restoreContext } from "./navigation.ts";
import { previewCleanup, previewJoin, previewLoad, scrollTitle } from "./commands/preview.ts";
import { CalendarAccessError } from "./calendar.ts";
import { BUNDLE_ID, str } from "./env.ts";
import { exec, osascript } from "./proc.ts";
import { type Action, errorStatus, merge, print, update, vars } from "./ui.ts";
import { agendaFilter, agendaLoad, agendaPickers, authorize, eventAction } from "./commands/agenda.ts";
import { createInit, createPickers, createRefresh, createSave } from "./commands/create.ts";
import { quick } from "./commands/quick.ts";
import { rootItems } from "./commands/root.ts";
import { parseDate } from "./dates.ts";

type Command = (args: string[]) => Promise<Action>;
const commands: Record<string, Command> = {
  back: async () => back(),
  "agenda-load": agendaLoad,
  "agenda-pickers": agendaPickers,
  "agenda-filter": agendaFilter,
  event: eventAction,
  quick,
  "create-init": createInit,
  "create-pickers": createPickers,
  "create-refresh": createRefresh,
  "create-save": createSave,
  authorize,
  "quick-preview": previewLoad,
  "quick-scroll": scrollTitle,
  "quick-preview-join": previewJoin,
  "quick-preview-cleanup": previewCleanup,
  "create-all-day": async ([checked = "false"]) =>
    update({
      startTime: { enabled: !["true", "1"].includes(checked) },
      endTime: { enabled: !["true", "1"].includes(checked) },
    }),
};

const post = async (): Promise<void> => {
  const out = process.env.cal_out ?? "";
  const day = process.env.cal_day || "";
  if (out === "back")
    await osascript(
      'tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)',
      `${str("kw_main", "cal")} `,
    );
  if (out === "agenda" || out === "create" || out === "return") {
    const returning = out === "return" ? decodeContext(process.env.cal_return || "") : undefined;
    if (out === "return" && !returning) throw new Error("Calendar navigation expired.");
    await osascript(
      'tell application id "com.runningwithcrayons.Alfred" to run trigger (item 1 of argv) in workflow (item 2 of argv) with argument (item 3 of argv)',
      returning?.screen.type || out,
      BUNDLE_ID,
      returning ? process.env.cal_return! : contextFor(out as "agenda" | "create", day),
    );
  }
  if (out === "show-date") {
    const date = parseDate(day);
    await exec("/usr/bin/osascript", [
      "-l",
      "JavaScript",
      "-e",
      'var run = argv => { const app = Application("Calendar"); app.activate(); app.viewCalendar({at:new Date(argv[0])}); };',
      date.toISOString(),
    ]);
  }
};

const [command = "", ...input] = process.argv.slice(2);
const originalQuery = process.env.cal_query || "";
let restored: Record<string, string> = {};
try {
  restored = command === "post" || command === "root" ? {} : restoreContext(originalQuery);
} catch (error) {
  print(errorStatus(error));
  process.exit(0);
}
Object.assign(process.env, restored);
const args = input.map((value) =>
  value === originalQuery && Object.keys(restored).length ? restored.cal_query || "" : value,
);
if (command === "root") process.stdout.write(JSON.stringify({ items: rootItems(args[0] || "") }));
else if (command === "post") {
  try {
    await post();
  } catch {
    process.stdout.write("Calendar could not open. Check Automation permissions for Alfred.");
  }
} else if (commands[command])
  print(
    merge(
      vars(restored),
      await commands[command]!(args).catch((error: unknown) =>
        merge(
          errorStatus(error),
          error instanceof CalendarAccessError &&
            update({ accessButton: { hidden: false, constraints: { size: { width: 85, height: 24 } } } }),
          command === "create-save" && update({ createButton: { enabled: true } }),
        ),
      ),
    ),
  );
else {
  print(errorStatus(new Error("Unknown Calendar command.")));
  process.exitCode = 1;
}
