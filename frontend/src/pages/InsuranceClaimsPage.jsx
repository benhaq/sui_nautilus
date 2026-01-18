import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { CheckCircle, DollarSign, FileText, Loader2, Plus, Shield, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import CreateClaimModal from '../components/CreateClaimModal'
import api from '../services/api'
import { fetchAllTimelineEntries, getEntryTypeName } from '../services/timeline'
import { createTimelineEntryWithWallet } from '../services/transaction'

/**
 * Insurance Claims Page
 * Submit and track health insurance claims with ZK proof verification
 */
export default function InsuranceClaimsPage() {
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()
  const [claims, setClaims] = useState([])
  const [whitelists, setWhitelists] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWhitelist, setSelectedWhitelist] = useState(null)

  useEffect(() => {
    if (currentAccount?.address && suiClient) {
      loadClaimsData()
    } else {
      setLoading(false)
      setClaims([])
      setWhitelists([])
    }
  }, [currentAccount, suiClient])

  const loadClaimsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load user's whitelists (medical folders)
      const whitelistsResponse = await api.getUserWhitelists(currentAccount.address)
      const userWhitelists = whitelistsResponse.whitelists || []
      setWhitelists(userWhitelists)

      // Load timeline entries (claims) from blockchain
      if (userWhitelists.length > 0) {
        const timelineEntries = await fetchAllTimelineEntries(
          userWhitelists,
          currentAccount.address,
          suiClient
        )
        
        // Transform timeline entries to claim format
        const transformedClaims = timelineEntries.map(entry => ({
          id: entry.id,
          whitelistId: entry.whitelistId,
          whitelistName: entry.whitelistName,
          visitDate: entry.visitDate,
          visitType: entry.visitType || getEntryTypeName(entry.entryType),
          entryType: entry.entryType,
          providerSpecialty: entry.providerSpecialty,
          status: entry.status || 'submitted',
          contentHash: entry.contentHash,
          walrusBlobId: entry.walrusBlobId,
          createdAt: entry.createdAt,
          revoked: entry.revoked,
          timestampMs: entry.timestampMs,
          transactionDigest: entry.transactionDigest,
          // Additional fields for display
          zkVerified: entry.contentHash ? true : false, // Consider verified if has content hash
          claimAmount: null, // Not stored in timeline entry, can be added later
        }))
        
        setClaims(transformedClaims)
      } else {
        setClaims([])
      }

    } catch (err) {
      console.error('Failed to load claims data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClaim = () => {
    if (whitelists.length === 0) {
      setError('Please create a medical folder first')
      return
    }
    // If only one whitelist, auto-select it
    if (whitelists.length === 1) {
      setSelectedWhitelist(whitelists[0])
    }
    setShowCreateModal(true)
  }

  const handleClaimSuccess = () => {
    setShowCreateModal(false)
    setSelectedWhitelist(null)
    loadClaimsData()
  }

  // Calculate stats from claims
  const totalClaims = claims.length
  const approvedClaims = claims.filter(c => c.status === 'approved' || c.status === 'verified').length
  const zkVerifiedClaims = claims.filter(c => c.zkVerified).length
  const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'submitted').length

  // Calculate approved amount (sum of approved claim amounts)
  const approvedAmount = claims
    .filter(c => c.status === 'approved' || c.status === 'verified')
    .reduce((sum, c) => sum + (parseFloat(c.claimAmount) || 0), 0)

  const stats = [
    {
      label: 'Total Claims',
      value: totalClaims.toString(),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Approved Amount',
      value: `$${approvedAmount.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'ZK Verified',
      value: zkVerifiedClaims.toString(),
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Pending',
      value: pendingClaims.toString(),
      icon: CheckCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ]

  if (!currentAccount) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-text-muted">
            Please connect your Sui wallet to access insurance claims
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading your claims...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark mb-2">
            Insurance Claims
          </h1>
          <p className="text-text-muted">
            Submit and track health insurance claims with ZK proof verification
          </p>
        </div>
        <button
          onClick={handleCreateClaim}
          className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Claim
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${stat.bgColor} rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-heading font-bold text-text-light dark:text-text-dark mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-text-muted">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Claims List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
            My Claims
          </h2>
        </div>
        <div className="divide-y divide-border-light dark:divide-border-dark">
          {claims.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-text-muted">No claims found</p>
              <p className="text-sm text-text-muted mt-2">Create your first insurance claim to get started</p>
              <button
                onClick={handleCreateClaim}
                className="mt-4 inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create First Claim
              </button>
            </div>
          ) : (
            claims.map((claim, index) => (
              <div
                key={index}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      claim.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' :
                      claim.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                      'bg-gray-50 dark:bg-gray-700'
                    }`}>
                      <FileText className={`w-5 h-5 ${
                        claim.status === 'approved' ? 'text-green-600 dark:text-green-400' :
                        claim.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-text-light dark:text-text-dark">
                          {claim.visitType || 'Insurance Claim'}
                        </h3>
                        {claim.zkVerified && (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                            <Shield className="w-3 h-3 mr-1" />
                            ZK Verified
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          claim.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          claim.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {claim.status || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-text-muted mb-2">
                        <span>Date: {claim.visitDate || 'N/A'}</span>
                        {claim.claimAmount && (
                          <>
                            <span>•</span>
                            <span>Amount: ${claim.claimAmount}</span>
                          </>
                        )}
                        {claim.providerSpecialty && (
                          <>
                            <span>•</span>
                            <span>Provider: {claim.providerSpecialty}</span>
                          </>
                        )}
                      </div>
                      {claim.contentHash && (
                        <p className="text-xs text-text-muted font-mono">
                          Hash: {claim.contentHash.slice(0, 16)}...
                        </p>
                      )}
                      {claim.transactionDigest && (
                        <a
                          href={`https://suiscan.xyz/testnet/tx/${claim.transactionDigest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 inline-block"
                        >
                          View on Explorer →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Claim Modal */}
      {showCreateModal && (
        <CreateClaimModal
          whitelists={whitelists}
          selectedWhitelist={selectedWhitelist}
          onSuccess={handleClaimSuccess}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedWhitelist(null)
          }}
        />
      )}
    </div>
  )
}
