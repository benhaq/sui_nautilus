/**
 * Utility function to combine class names conditionally
 * @param {...(string|boolean|null|undefined)} classes - Class names to combine
 * @returns {string} Combined class names
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format wallet address to short format
 * @param {string} address - Full wallet address
 * @param {number} startChars - Number of characters to show at start (default: 6)
 * @param {number} endChars - Number of characters to show at end (default: 4)
 * @returns {string} Formatted address
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format date to relative time (e.g., "2 days ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffInMs = now - then;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 30) {
    return then.toLocaleDateString();
  } else if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Format file size to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate Sui address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
export function isValidSuiAddress(address) {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Calculate user role in whitelist
 * @param {Object} whitelist - Whitelist object with owner, doctors, members
 * @param {string} userAddress - User's wallet address
 * @returns {number} Role (0=owner, 1=doctor, 2=member, 255=no access)
 */
export function calculateUserRole(whitelist, userAddress) {
  if (!whitelist || !userAddress) return 255;

  if (whitelist.owner === userAddress) return 0;
  if (whitelist.doctors?.includes(userAddress)) return 1;
  if (whitelist.members?.includes(userAddress)) return 2;

  return 255;
}

/**
 * Get role name from role number
 * @param {number} role - Role number
 * @returns {string} Role name
 */
export function getRoleName(role) {
  const roleNames = {
    0: 'owner',
    1: 'doctor',
    2: 'member',
    3: 'patient',
    255: 'none',
  };
  return roleNames[role] || 'none';
}

/**
 * Calculate permissions based on role
 * @param {number} role - User role
 * @returns {Object} Permissions object
 */
export function calculatePermissions(role) {
  return {
    canRead: role !== 255,
    canWrite: role === 0 || role === 1,
    canManage: role === 0,
  };
}

/**
 * Check if user has specific permission
 * @param {Object} whitelist - Whitelist object
 * @param {string} userAddress - User's address
 * @param {string} permission - Permission to check ('read', 'write', 'manage')
 * @returns {boolean} True if user has permission
 */
export function hasPermission(whitelist, userAddress, permission) {
  const role = calculateUserRole(whitelist, userAddress);
  const permissions = calculatePermissions(role);

  switch (permission) {
    case 'read':
      return permissions.canRead;
    case 'write':
      return permissions.canWrite;
    case 'manage':
      return permissions.canManage;
    default:
      return false;
  }
}

/**
 * Filter whitelists by user role
 * @param {Array} whitelists - Array of whitelists
 * @param {number} role - Role to filter by
 * @returns {Array} Filtered whitelists
 */
export function filterWhitelistsByRole(whitelists, role) {
  if (!Array.isArray(whitelists)) return [];
  return whitelists.filter((wl) => wl.role === role);
}

/**
 * Get role badge color
 * @param {number} role - User role
 * @returns {string} Tailwind color class
 */
export function getRoleBadgeColor(role) {
  const colors = {
    0: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    1: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    2: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    255: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
  };
  return colors[role] || colors[255];
}

/**
 * Format a timestamp (ms or s) to a readable string (e.g. 2026-01-14 15:07:36)
 * @param {number|string} timestamp - Unix timestamp in ms or s
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp) {
  let ts = Number(timestamp);
  if (ts < 1e12) ts = ts * 1000; // convert seconds to ms if needed
  const date = new Date(ts);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function bufferToUint8Array(bufferLike) {
  if (bufferLike instanceof Uint8Array) return bufferLike;

  if (bufferLike?.type === 'Buffer' && Array.isArray(bufferLike.data)) {
    return new Uint8Array(bufferLike.data);
  }

  throw new Error('Invalid decryptedData format');
}
