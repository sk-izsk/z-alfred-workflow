# LeetCode

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.leetcode`.
- Uses LeetCode's public GraphQL API without sign-in, and zerotrac's ratings file (cached a day).
  Never add login, cookies or submissions without an explicit request.
- Problem previews use the native `markdownarea`; HTML is converted with node-html-markdown.
- Opened from the Dev launcher (`dev:v1:` envelope); Back from the first screen returns there.
  Every screen and sheet shows Back in its footer.
- Tests replace the network (`setFetcher`); never call LeetCode from tests.
