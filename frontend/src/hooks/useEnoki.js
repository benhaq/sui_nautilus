import {
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useConnectWallet,
  useWallets,
} from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'

/**
 * Custom hook for Enoki wallet integration
 *
 * With the new registerEnokiWallets API, Enoki wallets appear as
 * standard wallets in the dApp Kit wallet selector. This hook
 * provides convenience methods for working with Enoki wallets.
 */
export function useEnoki() {
  const currentAccount = useCurrentAccount()
  const { currentWallet, connectionStatus } = useCurrentWallet()
  const { mutateAsync: disconnect } = useDisconnectWallet()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const { mutateAsync: connect } = useConnectWallet()
  const wallets = useWallets()

  /**
   * Check if the current wallet is an Enoki wallet (zkLogin)
   */
  const isEnokiWallet = () => {
    return currentWallet?.name?.toLowerCase().includes('enoki') ||
           currentWallet?.name?.toLowerCase().includes('google') ||
           currentWallet?.name?.toLowerCase().includes('facebook') ||
           currentWallet?.name?.toLowerCase().includes('twitch')
  }

  /**
   * Get available Enoki wallet options
   */
  const getEnokiWallets = () => {
    return wallets.filter(wallet =>
      wallet.name.toLowerCase().includes('enoki') ||
      wallet.name.toLowerCase().includes('google') ||
      wallet.name.toLowerCase().includes('facebook') ||
      wallet.name.toLowerCase().includes('twitch')
    )
  }

  /**
   * Connect with a specific Enoki provider (Google, Facebook, etc.)
   * This will open a popup for OAuth
   */
  const connectWithProvider = async (providerName = 'google') => {
    const enokiWallets = getEnokiWallets()
    const wallet = enokiWallets.find(w =>
      w.name.toLowerCase().includes(providerName.toLowerCase())
    )

    if (!wallet) {
      throw new Error(`Enoki wallet for ${providerName} not found. Make sure registerEnokiWallets is configured.`)
    }

    return connect({ wallet })
  }

  /**
   * Check if user is connected
   */
  const isConnected = () => {
    return connectionStatus === 'connected' && currentAccount !== null
  }

  /**
   * Get the user's Sui address
   */
  const getAddress = () => {
    return currentAccount?.address || null
  }

  /**
   * Disconnect wallet
   */
  const logout = async () => {
    if (isConnected()) {
      await disconnect()
    }
  }

  /**
   * Execute a transaction
   * Note: Sponsored transactions are handled automatically by Enoki
   * when using an Enoki wallet
   */
  const executeTransaction = async (transaction) => {
    if (!isConnected()) {
      throw new Error('Wallet not connected')
    }

    const result = await signAndExecute({
      transaction,
    })

    return result
  }

  /**
   * Create and execute a simple transfer
   */
  const transfer = async (recipient, amount) => {
    const tx = new Transaction()
    const [coin] = tx.splitCoins(tx.gas, [amount])
    tx.transferObjects([coin], recipient)

    return executeTransaction(tx)
  }

  return {
    // Connection state
    isConnected,
    isEnokiWallet,
    connectionStatus,
    currentAccount,
    currentWallet,

    // Auth methods
    connectWithProvider,
    logout,
    getAddress,

    // Wallet discovery
    getEnokiWallets,
    wallets,

    // Transaction methods
    executeTransaction,
    transfer,
  }
}

export default useEnoki
