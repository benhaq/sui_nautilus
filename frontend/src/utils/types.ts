export interface Folder {
  id: string;
  owner: string;
  label: string;
  folderType?: number;
  whitelistId: string;
  whitelistCapId: string;
  createdAt?: number;
  role?: number;
  roleName?: string;
}

export interface WhitelistWithRole {
  whitelistId: string;
  adminCapId: string;
  label: string;
  owner: string;
  creator: string;
  role: number;
  roleName: string;
  doctors: string[];
  members: string[];
  createdAt: number;
}

export interface UserRole {
  whitelistId: string;
  address: string;
  role: number;
  roleName: string;
  permissions: string[];
  hasAccess: boolean;
}

export interface MedicalRecord {
  id: string;
  whitelistId: string;
  uploader: string;
  docTypes: number[];
  fileCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Log {
  id: string;
  whitelistId: string;
  actor: string;
  action: string;
  recordId?: string;
  timestamp: number;
}

export interface WalletContextType {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<string>;
  signAndExecuteTransactionBlock: (tx: any) => Promise<any>;
}
