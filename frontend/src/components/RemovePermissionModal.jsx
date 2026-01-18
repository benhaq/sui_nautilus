import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { AlertCircle, CheckCircle, Loader2, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { removeDoctorWithWallet, removeMemberWithWallet } from '../services/transaction';

/**
 * Modal for removing doctors/members from whitelist
 */
export default function RemovePermissionModal({
  whitelist,
  type = 'doctor', // 'doctor' or 'member'
  address,
  onSuccess,
  onClose,
}) {
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isDoctor = type === 'doctor';
  const title = isDoctor ? 'Remove Doctor' : 'Remove Member';
  const actionFn = isDoctor ? removeDoctorWithWallet : removeMemberWithWallet;

  const handleRemove = async () => {
    try {
      setLoading(true);
      setError(null);
      // Call contract directly via transaction function
      const result = await actionFn({
        signAndExecuteTransaction,
        whitelistId: whitelist.whitelistId,
        [isDoctor ? 'doctor' : 'member']: address,
        whitelistCapId: whitelist.whitelistCapId,
      });

      setSuccess(result);

      if (onSuccess) {
        onSuccess(result);
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error(`Failed to remove ${type}:`, err);
      setError(err.message || `Failed to remove ${type}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
            {title}
          </h2>
          {!success && (
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
              {isDoctor ? 'Doctor' : 'Member'} Removed!
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
            <div className="mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-1">
                      Warning: This action cannot be undone
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Removing this {type} will revoke all their access to the whitelist.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-light dark:text-text-dark">
                  Address to remove:
                </label>
                <div className="bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-lg p-3">
                  <p className="text-sm font-mono text-text-light dark:text-text-dark break-all">
                    {address}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-text-light dark:text-text-dark disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Remove {isDoctor ? 'Doctor' : 'Member'}
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
