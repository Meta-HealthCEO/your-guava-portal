// Copy shown when a chosen file is refused before it is sent. Kept in one place
// because the .xls message is load-bearing: production's backend cannot import
// .xlsx until the read-excel-file repair ships, and CSV imports on every build,
// so this must never send an owner towards .xlsx (D-002 in the-road-to-90).

export const XLS_GUIDANCE =
  '.xls files aren\'t supported. In Excel choose File → Save As → "CSV UTF-8 (Comma delimited)", keep only the sheet with your sales, then upload that .csv.'

export const INVALID_TYPE = 'Invalid file type. Please upload a .csv or .xlsx file.'
