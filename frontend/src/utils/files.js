import { DOC_TYPE_TO_MIME, DOC_TYPES } from './constants';

export function detectDocTypeFromFile(file) {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  // === Imaging ===
  if (
    mime.startsWith('image/') ||
    name.endsWith('.dcm') // DICOM
  ) {
    return DOC_TYPES.IMAGING;
  }

  // === PDF ===
  if (mime === 'application/pdf') {
    return DOC_TYPES.REPORT;
  }

  // === Lab results (CSV, XLS, XLSX) ===
  if (
    mime.includes('spreadsheet') ||
    name.endsWith('.csv') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx')
  ) {
    return DOC_TYPES.LAB;
  }

  // === Text / Doc ===
  if (
    mime.includes('text') ||
    mime.includes('word') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt')
  ) {
    return DOC_TYPES.REPORT;
  }

  // === Default ===
  return DOC_TYPES.OTHER;
}

export function docTypeToMimeType(docType) {
  const mimes = DOC_TYPE_TO_MIME[docType];
  if (!mimes || mimes.length === 0) {
    return 'application/octet-stream';
  }
  return mimes[0];
}
