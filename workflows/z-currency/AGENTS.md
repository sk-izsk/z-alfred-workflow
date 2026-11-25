# Currency Exchange

- Independent Bun + TypeScript workflow; generate UI/plist and preserve com.izsk.currency.
- Never eval queries. Parse arithmetic with bounded input/depth and validate provider rates.
- Amounts and cross-rates are calculated locally. Preserve original rate dates; fetch time is separate.
- Historical responses must verify requested dates; never substitute latest data on history errors.
- API keys stay in configuration/environment, never command args, logs, cached state or exports.
- Back stays visible outside Actions and date sheets return to their parent.
- Preserve MIT catalog/icon attribution. Tests use synthetic rates and temporary cache/data directories.
- Run check, package and UI checker; keep prefs, bundles and caches out of Git.
