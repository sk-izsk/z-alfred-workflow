# Weather

- Independent Bun + TypeScript project; generate UI/plist and preserve com.izsk.weather.
- Use native controls and semantic theme colors, with colorful symbols for weather measurements.
- Preserve query/selection when Back returns from a city report; direct city launches have no hidden
  list level. Sheets close to their parent and Back stays visible outside Actions.
- Missing measurements are unknown, not zero. Never substitute current values for another forecast
  date. Mark failed-refresh cache fallback visibly and preserve provider dates/observation time.
- Tests use synthetic reports and mocked fetch. Never commit private saved cities or location caches.
- Preserve icon credits, MIT notices and AI disclosure. Run check, package and Alfred UI checker.
