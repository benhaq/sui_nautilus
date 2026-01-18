import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { AlertCircle, CheckCircle, Download, Loader2, Shield, X } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';
import { base64ToUint8Array } from '../utils/helpers';

/**
 * Modal for downloading and decrypting medical records
 * Uses wallet signature for authentication
 */
export default function DownloadRecordModal({
  record,
  fileIndex = 0,
  requesterAddress,
  onSuccess,
  onClose,
}) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Prepare download - Get message to sign from backend
      const prepareResponse = await api.prepareDownload(
        record.objectId,
        requesterAddress || currentAccount?.address,
        fileIndex,
      );
      console.log('prepareResponse:', prepareResponse);
      const { sessionId, message, messageBase64, mimeType, extension } = prepareResponse.data;

      // Step 2: Sign message with wallet
      const messageBytes = base64ToUint8Array(messageBase64);
      const { signature } = await signPersonalMessage({
        message: messageBytes,
      });
      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        setError('Wallet signature is required. Please approve the signature request.');
        setLoading(false);
        return;
      }

      // Step 3: Complete download with signature
      const blob = await api.completeDownload(record.objectId, sessionId, signature);
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical_record_${record.objectId.slice(0, 8)}`;
      a.type = mimeType || 'application/octet-stream';
      a.click();
      window.URL.revokeObjectURL(url);

      setSuccess(true);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err.message || 'Failed to download record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
            Download Record
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
          <div className="text-center">
            <div className="mb-4 mx-auto w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
              Download Complete
            </h3>
            <p className="text-sm text-text-muted">Your file has been downloaded successfully</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Record:</strong> {record?.objectId ? record.objectId.slice(0, 16) : 'N/A'}
                ...
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                File {fileIndex + 1} of {record?.filesCount || record?.walrusCids?.length || 1}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="mb-6 text-center">
              <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Sign to Download Record
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You need to sign a message with your wallet to authenticate and download this
                medical record.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-900 dark:text-blue-200">
                <strong>Security:</strong> Your wallet signature is used to authenticate your
                access. The file will be decrypted by the backend.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-text-light dark:text-text-dark rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Sign and Download
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
