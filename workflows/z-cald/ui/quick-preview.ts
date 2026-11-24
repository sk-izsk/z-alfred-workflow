import { button, label, run, type Json } from "./shared.ts";
type Action = Json;

export const previewTitle = (title: string): Action =>
  label("previewTitle", {
    text: title,
    tooltip: title,
    colour: "labelColor",
    font: { size: 14, weight: "semibold" },
    linebreak: "truncatetail",
    textalign: "left",
    constraints: { region: "top", stretch: "horizontal", size: { height: 24 } },
  });

export const emptyPreview = (): Json => ({
  id: "dayPreview",
  type: "view",
  constraints: { stretch: "horizontal", size: { height: 0 } },
  components: [],
});

export const previewPanel = (title: string, time: string, subtitle: string, hasLink: boolean): Json => ({
  id: "dayPreview",
  type: "view",
  layout: "border",
  padding: 10,
  spacing: 12,
  cornerradius: 6,
  background: null,
  border: { width: 1, colour: "separatorColor" },
  constraints: { stretch: "horizontal", size: { height: 64 } },
  components: [
    label("previewTime", {
      text: time,
      font: { size: 13, weight: "semibold" },
      linebreak: "truncatetail",
      constraints: { region: "left", position: "centre", size: { width: 86, height: 24 } },
    }),
    {
      type: "view",
      layout: "border",
      constraints: { region: "centre", stretch: "horizontal", size: { height: 44 } },
      components: [
        previewTitle(title),
        label("previewSubtitle", {
          text: subtitle,
          tooltip: `${title}\n${subtitle}`,
          colour: "labelColor",
          font: { size: 11.5 },
          linebreak: "truncatetail",
          constraints: { region: "bottom", size: { height: 16 } },
        }),
      ],
    },
    button("previewJoin", hasLink ? "Join  ⌘J" : "View event", run(["quick-preview-join"]), {
      bordered: true,
      constraints: { region: "right", position: "centre", size: { width: 90, height: 28 } },
    }),
  ],
});
