// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Sui Network Configuration
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';
export const SUI_RPC_URL = import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io';

// Walrus Configuration
export const WALRUS_PUBLISHER_URL =
  import.meta.env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR_URL =
  import.meta.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

// Contract Addresses
export const MEDICAL_VAULT_PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ||
  '0x1d10a3f87bdba6e54d2d09f7d708d5f9c6b3160b2599f5f01b18012eff8cb41e';
export const WHITELIST_REGISTRY =
  import.meta.env.VITE_WHITELIST_REGISTRY ||
  '0x7ed4009d46b33640fbec870a7af8bce18175f06ddb9134115e27ca64b4e07e4d';
export const CLOCK_OBJECT_ID = '0x6';

// Access Control Roles
export const ROLES = {
  OWNER: 0,
  DOCTOR: 1,
  MEMBER: 2,
  PATIENT: 3,
  NO_ACCESS: 255,
};

export const ROLE_NAMES = {
  0: 'Owner',
  1: 'Doctor',
  2: 'Member',
  3: 'Patient',
  255: 'No Access',
};

// Document Types (theo backend API)
export const DOC_TYPES = {
  LAB: 0,
  IMAGING: 1,
  REPORT: 2,
  PRESCRIPTION: 3,
  OTHER: 4,
};

export const DOC_TYPE_NAMES = {
  0: 'Lab Result',
  1: 'Imaging',
  2: 'Doctor Report',
  3: 'Prescription',
  4: 'Other',
};
// Record Types (legacy - for backward compatibility)
export const RECORD_TYPES = {
  LAB: 'Lab Result',
  IMAGING: 'Imaging',
  EXAMINATION: 'Doctor Report',
  PRESCRIPTION: 'Prescription',
  OTHER: 'Other',
};

// File Upload Limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILES_PER_UPLOAD = 10;
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Action Types
export const ACTION_TYPES = {
  CREATE_WHITELIST: 'CREATE_WHITELIST',
  ADD_DOCTOR: 'ADD_DOCTOR',
  ADD_MEMBER: 'ADD_MEMBER',
  REMOVE_DOCTOR: 'REMOVE_DOCTOR',
  REMOVE_MEMBER: 'REMOVE_MEMBER',
  UPLOAD_RECORD: 'UPLOAD_RECORD',
  DOWNLOAD_RECORD: 'DOWNLOAD_RECORD',
};

export const ACTION_TYPE_NAMES = {
  CREATE_WHITELIST: 'Created Whitelist',
  ADD_DOCTOR: 'Added Doctor',
  ADD_MEMBER: 'Added Member',
  REMOVE_DOCTOR: 'Removed Doctor',
  REMOVE_MEMBER: 'Removed Member',
  UPLOAD_RECORD: 'Uploaded Record',
  DOWNLOAD_RECORD: 'Downloaded Record',
};

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export const ENDPOINTS = {
  // Folders
  CREATE_FOLDER: '/folders/create',
  GET_FOLDERS: '/folders',
  ADD_DOCTOR: '/folders/:whitelistId/add-doctor',
  ADD_MEMBER: '/folders/:whitelistId/add-member',
  GET_USER_WHITELISTS: '/whitelists/user/:address/chain',
  GET_USER_ROLE: '/whitelists/:whitelistId/role/:address',
  GET_WHITELIST: '/whitelists/:whitelistId',

  // Records
  UPLOAD_RECORD: '/records/upload',
  GET_RECORDS: '/records/whitelist/:whitelistId',
  DOWNLOAD_FILE: '/records/:recordId/files/:fileIndex/download',
  ADD_FILES: '/records/:recordId/add-files',

  // Export
  EXPORT_RECORDS: '/export/export',

  // Log
  GET_AUDIT_LOGS: '/audit/:whitelistId',
};

export const DOC_TYPE_LABELS = {
  [DOC_TYPES.LAB]: 'Lab Results',
  [DOC_TYPES.IMAGING]: 'Imaging',
  [DOC_TYPES.REPORT]: 'Clinical Report',
  [DOC_TYPES.PRESCRIPTION]: 'Prescription',
  [DOC_TYPES.OTHER]: 'Other',
};

export const DOC_TYPE_TO_MIME = {
  [DOC_TYPES.LAB]: [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  [DOC_TYPES.IMAGING]: ['image/jpeg', 'image/png', 'image/webp', 'application/dicom'],
  [DOC_TYPES.PRESCRIPTION]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DOC_TYPES.REPORT]: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  [DOC_TYPES.OTHER]: ['application/octet-stream'],
};

export const ROLE_TYPES = {
  OWNER: 0,
  DOCTOR: 1,
  MEMBER: 2,
  NONE: 255,
};

export const ROLE_LABELS = {
  [ROLE_TYPES.OWNER]: 'Owner',
  [ROLE_TYPES.DOCTOR]: 'Doctor',
  [ROLE_TYPES.MEMBER]: 'Member',
  [ROLE_TYPES.NONE]: 'No Access',
};

export const ROLE_COLORS = {
  [ROLE_TYPES.OWNER]: '#f59e0b',
  [ROLE_TYPES.DOCTOR]: '#3b82f6',
  [ROLE_TYPES.MEMBER]: '#10b981',
  [ROLE_TYPES.NONE]: '#6b7280',
};
