import { useCurrentAccount } from '@mysten/dapp-kit'
import { Loader2, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import AddPermissionModal from '../components/AddPermissionModal'
import RemovePermissionModal from '../components/RemovePermissionModal'
import api from '../services/api'

export default function AccessControlPage() {
  const currentAccount = useCurrentAccount()
  const [whitelists, setWhitelists] = useState([])
  const [selectedWhitelist, setSelectedWhitelist] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalType, setAddModalType] = useState('doctor')
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState({ address: '', type: 'doctor' })

  useEffect(() => {
    if (currentAccount?.address) {
      loadWhitelists()
    }
  }, [currentAccount])

  const loadWhitelists = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getUserWhitelists(currentAccount.address)
      const ownedWhitelists = (response.whitelists || []).filter(w => w.role === 0)
      setWhitelists(ownedWhitelists)
      if (ownedWhitelists.length > 0 && !selectedWhitelist) {
        setSelectedWhitelist(ownedWhitelists[0])
      }
    } catch (err) {
      console.error('Failed to load whitelists:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPermission = (type) => {
    setAddModalType(type)
    setShowAddModal(true)
  }

  const handleRemovePermission = (address, type) => {
    setRemoveTarget({ address, type })
    setShowRemoveModal(true)
  }

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
            Please connect your Sui wallet to manage access permissions
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
          <p className="text-text-muted">Loading access control...</p>
        </div>
      </div>
    )
  }

  if (whitelists.length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark mb-2">
            No Whitelists Found
          </h2>
          <p className="text-text-muted">
            Create a whitelist first to manage access permissions
          </p>
        </div>
      </div>
    )
  }

  const doctors = selectedWhitelist?.doctors || []
  const members = selectedWhitelist?.members || []
  const totalPermissions = doctors.length + members.length

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark mb-2">
            Access Control
          </h1>
          <p className="text-text-muted">
            Manage who can access your medical records
          </p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <button 
            onClick={() => handleAddPermission('doctor')}
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Doctor
          </button>
          <button 
            onClick={() => handleAddPermission('member')}
            className="inline-flex items-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Member
          </button>
        </div>
      </div>

      {/* Whitelist Selector */}
      {whitelists.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
            Select Folder
          </label>
          <select
            value={selectedWhitelist?.whitelistId || ''}
            onChange={(e) => {
              const whitelist = whitelists.find(w => w.whitelistId === e.target.value)
              setSelectedWhitelist(whitelist)
            }}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark"
          >
            {whitelists.map((whitelist) => (
              <option key={whitelist.whitelistId} value={whitelist.whitelistId}>
                {whitelist.name || `Whitelist ${whitelist.whitelistId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-heading font-bold text-text-light dark:text-text-dark">
                {totalPermissions}
              </p>
              <p className="text-sm text-text-muted">Total Permissions</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-heading font-bold text-text-light dark:text-text-dark">
                {doctors.length}
              </p>
              <p className="text-sm text-text-muted">Doctors</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-heading font-bold text-text-light dark:text-text-dark">
                {members.length}
              </p>
              <p className="text-sm text-text-muted">Members</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Doctors Section */}
      {doctors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark overflow-hidden mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-border-light dark:border-border-dark">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">Doctors (Full Access)</h3>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {doctors.map((doctor, index) => (
              <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-text-light dark:text-text-dark font-mono text-sm">
                      {doctor}
                    </p>
                    <p className="text-xs text-text-muted">Can view and upload records</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemovePermission(doctor, 'doctor')}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  title="Remove doctor"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Section */}
      {members.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-border-light dark:border-border-dark">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200">Members (View Only)</h3>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {members.map((member, index) => (
              <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-text-light dark:text-text-dark font-mono text-sm">
                      {member}
                    </p>
                    <p className="text-xs text-text-muted">Can only view records</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemovePermission(member, 'member')}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  title="Remove member"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPermissions === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
            No Permissions Yet
          </h3>
          <p className="text-text-muted mb-4">
            Add doctors or members to grant access to this whitelist
          </p>
        </div>
      )}

      {/* Add Permission Modal */}
      {showAddModal && selectedWhitelist && (
        <AddPermissionModal
          whitelist={selectedWhitelist}
          type={addModalType}
          onSuccess={() => {
            loadWhitelists()
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Remove Permission Modal */}
      {showRemoveModal && selectedWhitelist && (
        <RemovePermissionModal
          whitelist={selectedWhitelist}
          type={removeTarget.type}
          address={removeTarget.address}
          onSuccess={() => {
            loadWhitelists()
          }}
          onClose={() => setShowRemoveModal(false)}
        />
      )}
    </div>
  )
}
