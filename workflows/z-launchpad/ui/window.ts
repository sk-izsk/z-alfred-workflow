// One web view for the grid (see src/page.ts for why) plus the standard footer: status, Back, Actions.
type Json = Record<string, unknown>;
const CLI = "../bin/launchpad";
const script = (args: string[], async = false): Json => ({
  type: "script",
  src: CLI,
  args,
  ...(async && { async: true }),
});
const LOADING = `<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:transparent;font:15px -apple-system;color:rgba(128,128,128,.8)">Loading…</body></html>`;

export const toolWindow = {
  bundleid: "com.izsk.launchpad",
  log: { level: "error", internal: true },
  variablesconfig: {
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "Launchpad",
    size: { width: 1100, height: 850 },
    minsize: { width: 560, height: 400 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [{ triggers: "launched", action: [script(["prepare-origin"]), script(["launch"], true)] }],
      shortcuts: [{ shortcut: "{var:actions_shortcut}", action: script(["menu"]) }],
      components: [
        {
          id: "grid",
          type: "webkitview",
          text: LOADING,
          focus: true,
          openlinksexternally: "^https?:",
          constraints: { region: "centre" },
          // The page reports changes by navigating to ?op=…; the script reads the new address.
          events: [{ triggers: "changed", action: script(["nav", "{value:grid.src}"], true) }],
        },
        {
          type: "view",
          layout: "border",
          padding: 10,
          spacing: 8,
          constraints: { region: "bottom" },
          components: [
            {
              id: "statusLabel",
              type: "label",
              text: "",
              font: { size: 10 },
              colour: "secondaryLabelColor",
              linebreak: "truncatetail",
              constraints: { region: "centre", stretch: "horizontal" },
            },
            {
              type: "view",
              layout: "inline",
              spacing: 10,
              constraints: { region: "right" },
              components: [
                {
                  id: "back",
                  type: "button",
                  text: "Back  {var:back_shortcut}",
                  shortcut: "{var:back_shortcut}",
                  bordered: false,
                  events: [
                    {
                      triggers: "actioned",
                      action: { type: "json", src: { finish: { variables: { launchpad_out: "back" } } } },
                    },
                  ],
                },
                {
                  id: "actionsButton",
                  type: "button",
                  text: "Actions  {var:actions_shortcut}",
                  bordered: false,
                  events: [{ triggers: "actioned", action: script(["menu"]) }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
};
