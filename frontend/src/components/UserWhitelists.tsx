import { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import ApiService from '../services/api';
import { ROLE_COLORS, ROLE_LABELS } from '../utils/constants';
import { formatAddress } from '../utils/helpers';
import { WhitelistWithRole } from '../utils/types';
import './UserWhitelists.css';

interface UserWhitelistsProps {
  onSelectWhitelist?: (whitelist: WhitelistWithRole) => void;
}

export const UserWhitelists = ({ onSelectWhitelist }: UserWhitelistsProps) => {
  const { address } = useWallet();
  const [whitelists, setWhitelists] = useState<WhitelistWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (address) {
      loadWhitelists();
    }
  }, [address]);

  const loadWhitelists = async () => {
    if (!address) return;

    setLoading(true);
    setError('');

    try {
      const data = await ApiService.getUserWhitelists(address);
      setWhitelists(data.whitelists || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load whitelists');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading your whitelists...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!whitelists || whitelists.length === 0) {
    return (
      <div className="card">
        <p>You don't have access to any medical folders yet.</p>
      </div>
    );
  }

  // Group whitelists by role
  const ownedWhitelists = whitelists.filter(w => w.role === 0);
  const doctorWhitelists = whitelists.filter(w => w.role === 1);
  const memberWhitelists = whitelists.filter(w => w.role === 2);

  return (
    <div className="user-whitelists">
      <h2>My Access & Permissions</h2>
      
      {ownedWhitelists.length > 0 && (
        <div className="whitelist-group">
          <h3>📁 Folders I Own ({ownedWhitelists.length})</h3>
          <div className="whitelist-grid">
            {ownedWhitelists.map((whitelist) => (
              <WhitelistCard
                key={whitelist.whitelistId}
                whitelist={whitelist}
                onSelect={onSelectWhitelist}
              />
            ))}
          </div>
        </div>
      )}

      {doctorWhitelists.length > 0 && (
        <div className="whitelist-group">
          <h3>👨‍⚕️ As Doctor ({doctorWhitelists.length})</h3>
          <p className="group-description">You can upload and view records</p>
          <div className="whitelist-grid">
            {doctorWhitelists.map((whitelist) => (
              <WhitelistCard
                key={whitelist.whitelistId}
                whitelist={whitelist}
                onSelect={onSelectWhitelist}
              />
            ))}
          </div>
        </div>
      )}

      {memberWhitelists.length > 0 && (
        <div className="whitelist-group">
          <h3>👁️ As Member ({memberWhitelists.length})</h3>
          <p className="group-description">You can view records (read-only)</p>
          <div className="whitelist-grid">
            {memberWhitelists.map((whitelist) => (
              <WhitelistCard
                key={whitelist.whitelistId}
                whitelist={whitelist}
                onSelect={onSelectWhitelist}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface WhitelistCardProps {
  whitelist: WhitelistWithRole;
  onSelect?: (whitelist: WhitelistWithRole) => void;
}

const WhitelistCard = ({ whitelist, onSelect }: WhitelistCardProps) => {
  const roleColor = ROLE_COLORS[whitelist.role] || '#6b7280';

  return (
    <div
      className="whitelist-card card"
      onClick={() => onSelect?.(whitelist)}
    >
      <div className="card-header">
        <h4>{whitelist.name}</h4>
        <span
          className="role-badge"
          style={{ backgroundColor: roleColor }}
        >
          {ROLE_LABELS[whitelist.role]}
        </span>
      </div>

      <div className="card-info">
        <p>
          <strong>Owner:</strong> {formatAddress(whitelist.owner)}
        </p>
        <p>
          <strong>Doctors:</strong> {whitelist.doctors?.length || 0}
        </p>
        <p>
          <strong>Members:</strong> {whitelist.members?.length || 0}
        </p>
      </div>

      <div className="permissions">
        {whitelist.role === 0 && (
          <div className="permission-tags">
            <span className="tag">👤 Manage</span>
            <span className="tag">✍️ Write</span>
            <span className="tag">👁️ Read</span>
          </div>
        )}
        {whitelist.role === 1 && (
          <div className="permission-tags">
            <span className="tag">✍️ Write</span>
            <span className="tag">👁️ Read</span>
          </div>
        )}
        {whitelist.role === 2 && (
          <div className="permission-tags">
            <span className="tag">👁️ Read Only</span>
          </div>
        )}
      </div>
    </div>
  );
};
