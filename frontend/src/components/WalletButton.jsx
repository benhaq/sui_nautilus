import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit'
import { LogOut, Wallet } from 'lucide-react'

export default function WalletButton() {
  const currentAccount = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (currentAccount) {
    return (
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex items-center px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <Wallet className="w-4 h-4 text-primary-600 dark:text-primary-400 mr-2" />
          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
            {formatAddress(currentAccount.address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="flex items-center px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline text-sm font-medium">Disconnect</span>
        </button>
      </div>
    )
  }

  return (
    <ConnectButton 
      connectText={
        <div className="flex items-center">
          <Wallet className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline text-sm font-medium">Connect Wallet</span>
        </div>
      }
    />
  )
}
