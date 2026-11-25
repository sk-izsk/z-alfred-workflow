import projects from "../assets/repository.json" with { type: "json" };
import type { Entry } from "./catalog.ts";
import { newer } from "./catalog.ts";
export const repositoryEntries = (releases: unknown): Entry[] => {
  if (!Array.isArray(releases)) throw new Error("Repository release metadata unavailable.");
  return projects.flatMap((p) => {
    const candidates = releases
      .filter(
        (r: any) =>
          !r.draft &&
          !r.prerelease &&
          typeof r.tag_name === "string" &&
          r.tag_name.startsWith(`${p.slug}/v`) &&
          Array.isArray(r.assets),
      )
      .toSorted((a: any, b: any) => (newer(a.tag_name.split("/v")[1], b.tag_name.split("/v")[1]) ? -1 : 1));
    const release = candidates[0];
    if (!release) return [];
    const asset = release.assets.find((a: any) => a.name === `${p.name}.alfredworkflow`);
    if (
      !asset ||
      !asset.browser_download_url.startsWith(
        "https://github.com/sk-izsk/z-alfred-workflow/releases/download/",
      )
    )
      return [];
    return [
      {
        uid: `repository:${p.slug}`,
        name: p.name,
        description: p.description,
        bundle: p.bundle,
        version: "",
        latest: release.tag_name.split("/v")[1],
        url: release.html_url,
        path: "",
        icon: "../icon.png",
        source: "repository" as const,
        download: asset.browser_download_url,
      },
    ];
  });
};
