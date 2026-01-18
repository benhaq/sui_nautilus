import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  Activity,
  AlertCircle,
  Calendar,
  FileText,
  Folder,
  Loader2,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AddPermissionModal from '../components/AddPermissionModal';
import CreateWhitelistModal from '../components/CreateWhitelistModal';
import RemovePermissionModal from '../components/RemovePermissionModal';
import api from '../services/api';

export default function DashboardPage() {
  const currentAccount = useCurrentAccount();
  const [whitelists, setWhitelists] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWhitelist, setSelectedWhitelist] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState('doctor');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState({ address: '', type: 'doctor' });

  useEffect(() => {
    if (currentAccount?.address) {
      loadDashboardData();
    } else {
      setLoading(false);
      setWhitelists([]);
      setRecentActions([]);
    }
  }, [currentAccount]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load whitelists
      const whitelistsResponse = await api.getUserWhitelists(currentAccount.address);
      console.log('Whitelists response:', whitelistsResponse);
      setWhitelists(whitelistsResponse.whitelists || []);

      // Load recent actions
      try {
        const actionsResponse = await api.getUserActions(currentAccount.address, 1, 5);
        setRecentActions(actionsResponse.actions || []);
      } catch (err) {
        console.error('Failed to load actions:', err);
        // Don't fail the whole dashboard if actions fail
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManageWhitelist = (whitelist) => {
    setSelectedWhitelist(whitelist);
  };

  const handleAddPermission = (type) => {
    setAddModalType(type);
    setShowAddModal(true);
  };

  const handleRemovePermission = (address, type) => {
    setRemoveTarget({ address, type });
    setShowRemoveModal(true);
  };

  // Calculate stats from actual data
  const stats = [
    {
      label: 'Medical Folders',
      value: whitelists.length.toString(),
      icon: Folder,
      color: 'text-blue-600',
    },
    {
      label: 'My Owned',
      value: whitelists.filter((w) => w.role === 3).length.toString(),
      icon: FileText,
      color: 'text-green-600',
    },
    {
      label: 'As Doctor',
      value: whitelists.filter((w) => w.role == 0 || w.role === 1).length.toString(),
      icon: Calendar,
      color: 'text-purple-600',
    },
    {
      label: 'As Member',
      value: whitelists.filter((w) => w.role === 2).length.toString(),
      icon: Activity,
      color: 'text-orange-600',
    },
  ];

  if (!currentAccount) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-text-muted">
            Please connect your Sui wallet to access your medical dashboard
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark mb-2">
            Dashboard
          </h1>
          <p className="text-text-muted">
            Welcome back! Here's an overview of your medical folders.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Folder
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-heading font-bold text-text-light dark:text-text-dark mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-text-muted">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* My Folders */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark mb-8">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
            My Folders
          </h2>
        </div>
        <div className="divide-y divide-border-light dark:divide-border-dark">
          {whitelists.length === 0 ? (
            <div className="p-12 text-center">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-text-muted">No whitelists found</p>
              <p className="text-sm text-text-muted mt-2">
                Create your first whitelist to get started
              </p>
            </div>
          ) : (
            whitelists.slice(0, 5).map((whitelist) => (
              <div
                key={whitelist.whitelistId}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <Folder className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-text-light dark:text-text-dark mb-1">
                        {whitelist.name || 'Unnamed Folder'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-text-muted mb-2">
                        <span>
                          Role:{' '}
                          {['Owner', 'Doctor', 'Member', 'Patient'][whitelist.role] || 'Unknown'}
                        </span>
                        <span>•</span>
                        <span>{whitelist.doctors?.length + 1 || 1} doctors</span>
                        <span>•</span>
                        <span>{whitelist.members?.length || 0} members</span>
                      </div>
                      {whitelist.role === 0 && (
                        <button
                          onClick={() => handleManageWhitelist(whitelist)}
                          className="inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors duration-200"
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Manage Permissions
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Activity
      {recentActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark">
          <div className="p-6 border-b border-border-light dark:border-border-dark">
            <h2 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {recentActions.map((action, index) => (
              <div
                key={index}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-text-light dark:text-text-dark mb-1">
                        {ACTION_TYPE_NAMES[action.actionType] || 'Unknown Action'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-text-muted">
                        {action.whitelistLabel && <span>{action.whitelistLabel}</span>}
                        {action.recordName && (
                          <>
                            <span>•</span>
                            <span>{action.recordName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {action.timestamp && (
                    <span className="text-sm text-text-muted">
                      {formatRelativeTime(action.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <CreateWhitelistModal
          onSuccess={() => {
            loadDashboardData();
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Permission Management Panel */}
      {selectedWhitelist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-border-light dark:border-border-dark p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark">
                  Manage Permissions
                </h2>
                <button
                  onClick={() => setSelectedWhitelist(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <Folder className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-medium text-text-light dark:text-text-dark">
                    {selectedWhitelist.name || 'Unnamed Folder'}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {selectedWhitelist.doctors?.length || 0} doctors •{' '}
                    {selectedWhitelist.members?.length || 0} members
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-b border-border-light dark:border-border-dark flex space-x-3">
              <button
                onClick={() => handleAddPermission('doctor')}
                className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add Doctor
              </button>
              <button
                onClick={() => handleAddPermission('member')}
                className="inline-flex items-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors duration-200"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add Member
              </button>
            </div>

            {/* Doctors List */}
            {selectedWhitelist.doctors && selectedWhitelist.doctors.length > 0 && (
              <div className="p-6 border-b border-border-light dark:border-border-dark">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
                    Doctors ({selectedWhitelist.doctors.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {selectedWhitelist.doctors.map((doctor, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-text-light dark:text-text-dark">
                            {doctor}
                          </p>
                          <p className="text-xs text-text-muted">Can view and upload records</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePermission(doctor, 'doctor')}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                        title="Remove doctor"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members List */}
            {selectedWhitelist.members && selectedWhitelist.members.length > 0 && (
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg mr-3">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
                    Members ({selectedWhitelist.members.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {selectedWhitelist.members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-text-light dark:text-text-dark">
                            {member}
                          </p>
                          <p className="text-xs text-text-muted">Can only view records</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePermission(member, 'member')}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                        title="Remove member"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!selectedWhitelist.doctors || selectedWhitelist.doctors.length === 0) &&
              (!selectedWhitelist.members || selectedWhitelist.members.length === 0) && (
                <div className="p-12 text-center">
                  <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
                    No Permissions Yet
                  </h3>
                  <p className="text-text-muted">
                    Add doctors or members to grant access to this folder
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Add Permission Modal */}
      {showAddModal && selectedWhitelist && (
        <AddPermissionModal
          whitelist={selectedWhitelist}
          type={addModalType}
          onSuccess={() => {
            setShowAddModal(false);
            loadDashboardData();
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
            setShowRemoveModal(false);
            loadDashboardData();
          }}
          onClose={() => setShowRemoveModal(false)}
        />
      )}
    </div>
  );
}
