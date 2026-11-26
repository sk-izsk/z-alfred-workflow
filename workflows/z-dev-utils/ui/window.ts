import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.dev-utils",
  cli: "devutils",
  title: "Dev Utils",
  placeholder: "Search transformations…",
  primary: "Copy Output  ↩",
});
export const run = (cmd: string, args: string[] = []): Json => ({
  ...ui.run(cmd, args, false),
  variables: { devutils_text: "{value:input.text}" },
});
export const copyOutput = (paste = false): Json => ({
  type: "json",
  variables: { devutils_copy_value: "{value:output.text}" },
  src: {
    copy: { type: "text", src: "{var:devutils_copy_value}" },
    ...(paste
      ? { finish: { variables: { devutils_out: "paste" } } }
      : { update: { ids: { statusLabel: { text: "Copied output", colour: "secondaryLabelColor" } } } }),
  },
});
export const toolWindow = JSON.parse(JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return"));
toolWindow.variablesconfig.devutils_text = { default: "", scriptenv: true };
export const components = (input: string): Json[] => {
  const values = structuredClone(ui.components(""));
  values[0]!.components[0].focus = false;
  values[0]!.components[0].events[1].action = copyOutput();
  const list = values[1]!.components[0];
  list.constraints = { region: "left", size: { width: 205 } };
  list.cell.height = 42;
  list.cell.root.components[0].constraints.size = { width: 19, height: 19 };
  list.cell.root.components[1].components.splice(1, 1);
  delete list.cell.init["rowDescription.colour"];
  delete list.cell.selected["rowDescription.colour"];
  list.cell.root.components[1].components[0].font.size = 12;
  list.events = [
    { triggers: "changed", action: run("select", ["{value:self.selected.uid}"]) },
    { triggers: "actioned", action: copyOutput() },
  ];
  const editor = (id: string, title: string, text: string, editable: boolean): Json => ({
    type: "view",
    layout: "border",
    spacing: 6,
    constraints: { grid: { row: id === "input" ? 0 : 1, col: 0, colweight: 1, rowweight: 0.5 } },
    components: [
      {
        type: "label",
        text: title,
        font: { size: 11, weight: "medium" },
        colour: "secondaryLabelColor",
        constraints: { region: "top" },
      },
      {
        id,
        type: "textarea",
        text,
        editable,
        selectable: true,
        focus: editable,
        disableallsubstitutions: true,
        background: null,
        bordertype: "none",
        font: { size: 13, monospaced: true },
        textinsets: { horizontal: 6, vertical: 6 },
        constraints: { region: "centre", size: { height: 150 } },
        ...(editable ? { events: [{ triggers: "typingstopped", action: run("transform") }] } : {}),
      },
    ],
  });
  values[1]!.components.push({
    type: "view",
    layout: "flex",
    rows: 2,
    cols: 1,
    spacing: 12,
    constraints: { region: "centre" },
    components: [editor("input", "INPUT · stays local", input, true), editor("output", "OUTPUT", "", false)],
  });
  values[2]!.components[1].components[1].events = [{ triggers: "actioned", action: copyOutput() }];
  values[2]!.components[1].components[2].events = [{ triggers: "actioned", action: run("menu") }];
  return values;
};
