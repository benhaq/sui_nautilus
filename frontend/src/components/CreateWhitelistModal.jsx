import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { CheckCircle, Loader2, Plus, XCircle } from 'lucide-react';
import { useState } from 'react';
import { createWhitelistWithWallet } from '../services/transaction';

/**
 * Example component showing how to use wallet signing for transactions
 */
export default function CreateWhitelistModal({ onSuccess, onClose }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [label, setLabel] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleCreateWhitelist = async () => {
    if (!label.trim()) {
      setError('Please enter a whitelist name');
      return;
    }

    if (!patientAddress.trim()) {
      setError('Please enter a patient address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create whitelist with wallet signing - calls contract directly
      const result = await createWhitelistWithWallet({
        signAndExecuteTransaction,
        label: label.trim(),
        patientAddress: patientAddress.trim(),
      });

      setSuccess(result);

      // Notify parent component
      if (onSuccess) {
        onSuccess(result);
      }

      // Auto close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to create whitelist:', err);
      setError(err.message || 'Failed to create whitelist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark mb-4">
          Create New Folder
        </h2>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
              Folder Created!
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Personal Medical Records"
                disabled={loading}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark disabled:opacity-50"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Patient Address
              </label>
              <input
                type="text"
                value={patientAddress}
                onChange={(e) => setPatientAddress(e.target.value)}
                placeholder="0x..."
                disabled={loading}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark disabled:opacity-50 font-mono text-sm"
              />
              <p className="text-xs text-text-muted mt-1">
                The patient who will have read access to this whitelist
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Note:</strong> You will be asked to sign this transaction with your Sui
                wallet. No private keys are sent to the server.
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
                onClick={handleCreateWhitelist}
                disabled={loading || !label.trim() || !patientAddress.trim()}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Folder
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
