import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CheckCircle, FileText, Loader2, Upload, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';
import { DOC_TYPE_NAMES } from '../utils/constants';
import { detectDocTypeFromFile } from '../utils/files';

/**
 * Modal for uploading medical records with wallet signing
 * Implements 3-step flow: Upload → Sign → Confirm
 */
export default function UploadRecordModal({
  whitelists,
  initialWhitelistId = null,
  onSuccess,
  onClose,
}) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [selectedWhitelist, setSelectedWhitelist] = useState(initialWhitelistId || '');
  const [files, setFiles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [step, setStep] = useState('select'); // 'select', 'uploading', 'signing', 'confirming', 'success'

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 10) {
      setError('Maximum 10 files allowed');
      return;
    }

    const invalidFiles = selectedFiles.filter((f) => f.size > 100 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setError('Each file must be under 100MB');
      return;
    }

    setFiles(selectedFiles);

    const detectedDocTypes = [];
    for (const file of selectedFiles) {
      const type = detectDocTypeFromFile(file);
      detectedDocTypes.push(type);
    }
    setDocTypes(detectedDocTypes);
    setError(null);
  };

  const handleDocTypeChange = (index, type) => {
    const newDocTypes = [...docTypes];
    newDocTypes[index] = parseInt(type);
    setDocTypes(newDocTypes);
  };

  const handleUpload = async () => {
    if (!selectedWhitelist || files.length === 0) {
      setError('Please select whitelist and files');
      return;
    }

    const whitelist = whitelists.find((w) => w.whitelistId === selectedWhitelist);
    if (!whitelist) {
      setError('Invalid whitelist');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Upload files (backend encrypts and uploads to Walrus)
      setStep('uploading');
      const formData = new FormData();
      formData.append('whitelistId', whitelist.whitelistId);
      formData.append('uploader', currentAccount.address);
      formData.append('docTypes', docTypes.join(','));
      const adminCapId = whitelist.role === 0 ? whitelist.whitelistCapId : 'doctor/member mode';
      formData.append('adminCapId', adminCapId);
      // Note: DO NOT send privateKey for wallet signing mode
      // Backend will return transactionBlockBytes instead of auto-executing
      files.forEach((file) => {
        formData.append('files', file);
      });

      const uploadResponse = await api.uploadRecord(formData);
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || uploadResponse.message || 'Upload failed');
      }

      if (uploadResponse.digest && !uploadResponse.transactionBlockBytes) {
        setSuccess({
          recordId: uploadResponse.objectId,
          digest: uploadResponse.digest,
          explorerUrl: uploadResponse.explorerUrl,
        });
        setStep('success');

        if (onSuccess) {
          onSuccess(uploadResponse);
        }
        return;
      }

      // Step 2: Sign and execute transaction with wallet
      if (!uploadResponse.transactionBlockBytes) {
        throw new Error(
          'No transaction bytes received from server. Backend may require privateKey parameter.',
        );
      }

      setStep('signing');
      const txBytes = new Uint8Array(uploadResponse.transactionBlockBytes);
      const txBlock = Transaction.from(txBytes);
      const result = await signAndExecuteTransaction({
        transaction: txBlock,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Show success immediately after transaction confirmed
      setSuccess({
        recordId: uploadResponse.pendingRecordId || uploadResponse.objectId,
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
      });
      setStep('success');

      if (onSuccess) {
        onSuccess({
          recordId: uploadResponse.pendingRecordId || uploadResponse.objectId,
          digest: result.digest,
          explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        });
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message || 'Failed to upload record');
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const getStepMessage = () => {
    switch (step) {
      case 'uploading':
        return 'Encrypting and uploading files to Walrus...';
      case 'signing':
        return 'Please sign the transaction in your wallet...';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
            Upload Medical Record
          </h2>
          {!loading && !success && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
              Record Uploaded Successfully!
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Transaction: {success.digest.slice(0, 10)}...
            </p>
            <a
              href={success.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 text-sm underline"
            >
              View on Explorer
            </a>
          </div>
        ) : (
          <>
            {loading && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-3" />
                  <p className="text-sm text-blue-900 dark:text-blue-200">{getStepMessage()}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Whitelist Selection */}
              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                  Select Folder
                </label>
                <select
                  value={selectedWhitelist}
                  onChange={(e) => setSelectedWhitelist(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark disabled:opacity-50"
                >
                  <option value="">Choose a folder...</option>
                  {whitelists
                    .filter((w) => w.role === 0 || w.role === 1) // Owner or Doctor
                    .map((whitelist) => (
                      <option key={whitelist.whitelistId} value={whitelist.whitelistId}>
                        {whitelist.name || `Folder ${whitelist.whitelistId.slice(0, 8)}...`} (
                        {['Owner', 'Doctor'][whitelist.role]})
                      </option>
                    ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                  Select Files (Max 10 files, 100MB each)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark disabled:opacity-50"
                />
              </div>

              {/* Files List with Doc Types */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-light dark:text-text-dark">
                    Document Types
                  </label>
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-light dark:text-text-dark truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <select
                        value={docTypes[index]}
                        onChange={(e) => handleDocTypeChange(index, e.target.value)}
                        disabled={loading}
                        className="px-3 py-1 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                      >
                        {Object.entries(DOC_TYPE_NAMES).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-xs text-yellow-900 dark:text-yellow-200">
                  <strong>Security:</strong> Files will be encrypted before upload. Transaction will
                  be signed by your wallet. No private keys are exposed.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-text-light dark:text-text-dark rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={loading || !selectedWhitelist || files.length === 0}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {step === 'uploading' && 'Uploading...'}
                    {step === 'signing' && 'Signing...'}
                    {step === 'confirming' && 'Confirming...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Record
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
