import { useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { CheckCircle, Loader2, UserPlus, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { addDoctorWithWallet, addMemberWithWallet } from '../services/transaction'

/**
 * Modal for adding doctors/members to whitelist with wallet signing
 */
export default function AddPermissionModal({ 
  whitelist, 
  type = 'doctor', // 'doctor' or 'member'
  onSuccess, 
  onClose 
}) {
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const isDoctor = type === 'doctor'
  const title = isDoctor ? 'Add Doctor' : 'Add Member'
  const actionFn = isDoctor ? addDoctorWithWallet : addMemberWithWallet

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError('Please enter an address')
      return
    }

    if (!address.startsWith('0x') || address.length !== 66) {
      setError('Invalid Sui address format')
      return
    }

    try {
      setLoading(true)
      setError(null)
      // Call contract directly via transaction function
      const result = await actionFn({
        signAndExecuteTransaction,
        whitelistId: whitelist.whitelistId,
        [isDoctor ? 'doctor' : 'member']: address,
        whitelistCapId: whitelist.whitelistCapId,
        // No ownerAddress needed - contract calls directly
      })

      setSuccess(result)
      
      if (onSuccess) {
        onSuccess(result)
      }

      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      console.error(`Failed to add ${type}:`, err)
      setError(err.message || `Failed to add ${type}`)
    } finally {
      setLoading(false)
    }
  }

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
              {isDoctor ? 'Doctor' : 'Member'} Added!
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
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Folder:</strong> {whitelist.name || 'Unnamed'}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {isDoctor 
                  ? 'Doctors can view and upload medical records' 
                  : 'Members can only view medical records'}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {isDoctor ? 'Doctor' : 'Member'} Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                disabled={loading}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark disabled:opacity-50 font-mono text-sm"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-900 dark:text-yellow-200">
                <strong>Security:</strong> Transaction will be signed by your wallet. No private keys are exposed.
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
                onClick={handleSubmit}
                disabled={loading || !address.trim()}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Add {isDoctor ? 'Doctor' : 'Member'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
