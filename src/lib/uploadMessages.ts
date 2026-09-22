// Copy shown when a chosen file is refused before it is sent. Kept in one place
// because the .xls message is load-bearing: production's backend cannot import
// .xlsx until the read-excel-file repair ships, and CSV imports on every build,
// so this must never send an owner towards .xlsx (D-002 in the-road-to-90).

export const XLS_GUIDANCE =
  '.xls files aren\'t supported. In Excel choose File → Save As → "CSV UTF-8 (Comma delimited)", keep only the sheet with your sales, then upload that .csv.'

export const INVALID_TYPE = 'Invalid file type. Please upload a .csv or .xlsx file.'

/**
 * What deleting an upload will actually do, in the owner's terms.
 *
 * Deleting an upload that contributed no rows no longer touches transactions,
 * forecasts or insights (the backend guards that on the rows actually linked to
 * it), so promising to "refresh the affected forecasts" for a stranded upload
 * would be describing work the product does not do.
 */
export const deleteUploadConsequence = (fileName: string, importedRows: number): string =>
  importedRows > 0
    ? `This removes the ${importedRows.toLocaleString('en-ZA')} transaction${importedRows === 1 ? '' : 's'} imported from ${fileName} and refreshes the forecasts built on them. This cannot be undone.`
    : `This removes ${fileName} from your history. Nothing was imported from it, so your transactions and forecasts are unaffected. This cannot be undone.`
