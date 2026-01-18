import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Hook to fetch and manage user's whitelists
 * @param {string} userAddress - User's wallet address
 * @param {Object} options - Hook options
 * @returns {Object} Whitelists data and methods
 */
export function useWhitelists(userAddress, options = {}) {
  const { autoFetch = true, pollInterval = null } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWhitelists = async () => {
    if (!userAddress) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.getUserWhitelists(userAddress);
      setData(response);
      return response;
    } catch (err) {
      console.error('Failed to fetch whitelists:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && userAddress) {
      fetchWhitelists();
    }
  }, [userAddress, autoFetch]);

  // Auto-refresh with polling
  useEffect(() => {
    if (!pollInterval || !userAddress) return;

    const interval = setInterval(() => {
      fetchWhitelists();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, userAddress]);

  return {
    whitelists: data?.whitelists || [],
    count: data?.count || 0,
    loading,
    error,
    refresh: fetchWhitelists,
  };
}

/**
 * Hook to fetch whitelist access info
 * @param {string} whitelistId - Whitelist ID
 * @param {string} userAddress - User's address
 * @returns {Object} Access info and methods
 */
export function useWhitelistAccess(whitelistId, userAddress) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkAccess = async () => {
    if (!whitelistId || !userAddress) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.checkWhitelistAccess(whitelistId, userAddress);
      setData(response);
      return response;
    } catch (err) {
      console.error('Failed to check access:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (whitelistId && userAddress) {
      checkAccess();
    }
  }, [whitelistId, userAddress]);

  return {
    access: data,
    role: data?.role,
    roleName: data?.roleName,
    hasRead: data?.hasRead,
    hasWrite: data?.hasWrite,
    permissions: data?.permissions,
    loading,
    error,
    refresh: checkAccess,
  };
}

/**
 * Hook to fetch all accessible records
 * @param {string} userAddress - User's address
 * @returns {Object} Records data and methods
 */
export function useAccessibleRecords(userAddress) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecords = async () => {
    if (!userAddress) return;

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get all whitelists
      const whitelistsResponse = await api.getUserWhitelists(userAddress);
      const whitelists = whitelistsResponse.whitelists || [];

      if (whitelists.length === 0) {
        setData({
          whitelists: [],
          allRecords: [],
          summary: {
            totalWhitelists: 0,
            totalRecords: 0,
            byRole: { owner: 0, doctor: 0, member: 0 },
          },
        });
        return;
      }

      // Step 2: Batch fetch records for each whitelist
      const recordsPromises = whitelists.map((wl) =>
        api
          .getWhitelistRecords(wl.whitelistId)
          .then((res) => ({ whitelist: wl, records: res.records || [] }))
          .catch((err) => {
            console.error(`Failed to fetch records for ${wl.whitelistId}:`, err);
            return { whitelist: wl, records: [] };
          }),
      );

      const recordsByWhitelist = await Promise.all(recordsPromises);

      // Step 3: Flatten records with metadata
      const allRecords = recordsByWhitelist.flatMap((item) =>
        item.records.map((record) => ({
          ...record,
          whitelistId: item.whitelist.whitelistId,
          whitelistName: item.whitelist.name,
          userRole: item.whitelist.roleName,
          canWrite: item.whitelist.hasWrite,
          canRead: item.whitelist.hasRead,
        })),
      );

      const result = {
        whitelists: recordsByWhitelist,
        allRecords,
        summary: {
          totalWhitelists: whitelists.length,
          totalRecords: allRecords.length,
          byRole: {
            owner: whitelists.filter((w) => w.role === 0).length,
            doctor: whitelists.filter((w) => w.role === 1).length,
            member: whitelists.filter((w) => w.role === 2).length,
          },
        },
      };

      setData(result);
      return result;
    } catch (err) {
      console.error('Failed to fetch records:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userAddress) {
      fetchRecords();
    }
  }, [userAddress]);

  return {
    records: data?.allRecords || [],
    whitelists: data?.whitelists || [],
    summary: data?.summary,
    loading,
    error,
    refresh: fetchRecords,
  };
}

/**
 * Hook to fetch user actions/history
 * @param {string} userAddress - User's address
 * @param {Object} options - Pagination options
 * @returns {Object} Actions data and methods
 */
export function useUserActions(userAddress, options = {}) {
  const { page = 1, limit = 50 } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActions = async () => {
    if (!userAddress) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.getUserActions(userAddress, page, limit);
      setData(response);
      return response;
    } catch (err) {
      console.error('Failed to fetch actions:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userAddress) {
      fetchActions();
    }
  }, [userAddress, page, limit]);

  return {
    actions: data?.actions || [],
    count: data?.count || 0,
    loading,
    error,
    refresh: fetchActions,
  };
}
