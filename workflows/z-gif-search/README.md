# GIF Search for Alfred 6

Search animated GIFs from the standalone `gifsearch` keyword or Swiss. Choose **List** or **Grid** from the dropdown beside the provider. The layout is remembered. Search typing stays focused; changing layout preserves the search, source and selection.

Command-K offers Copy GIF, Copy GIF Link, Copy Markdown, Paste Markdown, favorite/unfavorite, animated Details, Copy Page Link, Open in Browser, Download GIF, Load More, Refresh and Configuration. Return defaults to copying the actual GIF file; change it in Workflow Configuration. Downloads use unique filenames in Downloads. Details has its own visible Back action; closing it returns to the same results. Hyper+B returns to Swiss with its previous search/selection, or Alfred search when invoked independently.

![Compact native GIF grid](assets/screenshots/grid.png)

## Providers and refresh

GIPHY and Klipy use the public service endpoints used by the pinned Raycast reference. No bundled API key is used. These third-party endpoints are not guaranteed for Alfred. The GIPHY reference endpoint returned real results during verification. Klipy pagination is limited to the first page. Finer GIFs Club is a smaller searchable catalog with no trending feed; its live endpoint returned HTTP 530 during verification and errors remain visible. Switch provider if a service is unavailable.

Choose **GIPHY direct** to use the official GIPHY API with your own key in Workflow Configuration. The key is excluded from settings export and never written to search caches or command arguments. Local preferences are not included in packages. GIPHY search is limited to 50 characters. Results are cached for five minutes by default; configure 0–60 minutes, or Command-R to fetch now. A failed refresh reports an error and keeps existing results instead of presenting them as newly fetched. Favorites/recent GIF metadata stays local. Network searches go to the selected provider; previews load from its media host.

Native list/grid previews use Alfred image cells; use Details for an animated preview. GIF files are downloaded on explicit Copy/Download, limited to 30 MB and checked for GIF content. No cleanup or dependency installation runs automatically.

## Development

Run `bun run check`, `bun run package`, then `bun run link` for development installation. Node.js or Bun is required. Standard width 780, screen-aware clamping, configurable Hyper modifiers and compact footer labels follow [UI_CONVENTIONS.md](../../UI_CONVENTIONS.md).

Built with help from AI tools. Reference: [Raycast GIF Search](https://github.com/raycast/extensions/tree/dccfc8877dd0e658295cb4b6d29b4a0a1b79baf8/extensions/gif-search/). Provider behavior and actions informed this independent implementation. [GIPHY API documentation](https://developers.giphy.com/docs/api/endpoint/).
