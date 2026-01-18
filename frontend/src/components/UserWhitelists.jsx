import { useCurrentAccount } from '@mysten/dapp-kit';
import { Folder, Loader2, Plus, Shield, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../services/api';
import { ROLE_NAMES } from '../utils/constants';
import { formatRelativeTime } from '../utils/helpers';

export default function UserWhitelists({ onSelectWhitelist }) {
  const currentAccount = useCurrentAccount();
  const [whitelists, setWhitelists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (currentAccount?.address) {
      loadWhitelists();
    }
  }, [currentAccount]);

  const loadWhitelists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getUserWhitelists(currentAccount.address);
      setWhitelists(response.whitelists || []);
    } catch (err) {
      console.error('Failed to load whitelists:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 0:
        return <Shield className="w-4 h-4" />;
      case 1:
        return <UserCheck className="w-4 h-4" />;
      case 2:
        return <Users className="w-4 h-4" />;
      case 3:
        return <User className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 0:
        return 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800';
      case 1:
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 2:
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 3:
        return 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800';
      default:
        return 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  if (!currentAccount) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-8 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-text-muted">Connect wallet to view your whitelists</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-8 text-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto" />
        <p className="text-text-muted mt-4">Loading whitelists...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <button
          onClick={loadWhitelists}
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-heading font-bold text-text-light dark:text-text-dark">
          Your Whitelists ({whitelists.length})
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Whitelist
        </button>
      </div>

      {whitelists.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
            No Whitelists Yet
          </h3>
          <p className="text-text-muted mb-6">
            Create your first whitelist to start managing medical records
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 cursor-pointer shadow-sm font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Whitelist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {whitelists.map((whitelist) => (
            <div
              key={whitelist.whitelistId}
              onClick={() => onSelectWhitelist && onSelectWhitelist(whitelist)}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark hover:border-primary-500 dark:hover:border-primary-500 transition-all duration-200 cursor-pointer hover:shadow-lg p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors duration-200">
                    <Folder className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div
                    className={`flex items-center space-x-1 px-2 py-1 rounded-md border ${getRoleColor(whitelist.role)}`}
                  >
                    {getRoleIcon(whitelist.role)}
                    <span className="text-xs font-medium">{ROLE_NAMES[whitelist.role]}</span>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-heading font-semibold text-text-light dark:text-text-dark mb-2 truncate">
                {whitelist.name || 'Unnamed Whitelist'}
              </h3>

              <div className="space-y-2 text-sm text-text-muted">
                <div className="flex items-center justify-between">
                  <span>Doctors:</span>
                  <span className="font-medium text-text-light dark:text-text-dark">
                    {whitelist.doctors?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Members:</span>
                  <span className="font-medium text-text-light dark:text-text-dark">
                    {whitelist.members?.length || 0}
                  </span>
                </div>
                {whitelist.createdAt && (
                  <div className="text-xs pt-2 border-t border-border-light dark:border-border-dark">
                    Created {formatRelativeTime(whitelist.createdAt)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
