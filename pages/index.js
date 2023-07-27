import React, { useState, useEffect } from "react"
import NavBar from "@/components/NavBar"
import { ConnectWallet, useSigner, useChain, useSwitchChain, ChainId } from "@thirdweb-dev/react"
import { Polygon } from "@thirdweb-dev/chains"
import { SignerContext } from "../contexts/SignerContext"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
import { MarginAccountDashboard } from "@/components/MarginAccountDashboard"
import { PositionsDashboard } from "@/components/PositionsDashboard"
import { TradingPerformanceDashboard } from "@/components/TradingPerformanceDashboard"
import { TransactionHistory } from "@/components/TransactionHistory"

export default function index() {
    const signer = useSigner()
    const chain = useChain()
    const switchChain = useSwitchChain()

    const [chainOk, setChainOk] = useState(false)

    useEffect(() => {
        if (chain && chain.name.toLowerCase() != "polygon mainnet") {
            setChainOk(false)
            // setChainOk(true) // testing
        } else {
            setChainOk(true)
        }
    }, [chain, signer, chainOk])

    return (
        <div>
            <div className="relative">
                <NavBar />
            </div>
            {!signer ? (
                <div className="flex flex-col items-center justify-center h-screen">
                    <img src="/connect-wallet.png" alt="Connect wallet icon" className="h-16" />
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                        <div className="text-lg justify-center mt-8">
                            <ConnectWallet />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mx-auto max-w-6xl px-4 pt-24 mb-16 sm:px-6 lg:px-8">
                    {!chainOk && (
                        <div className="flex flex-col items-center justify-center h-screen">
                            <img src="/polygon-logo.svg" alt="Polygon Logo" className="h-8" />
                            <div className="text-lg text-white font-regular mt-4">
                                Switch to Polygon Mainnet. Cross-chain trading coming soon.
                            </div>
                            <div
                                onClick={() => switchChain(Polygon.chainId)}
                                className="text-sm mt-4 text-black bg-white hover:text-white hover:bg-zinc-700 px-6 py-4 rounded-lg"
                            >
                                Switch Network
                            </div>
                        </div>
                    )}
                    {chainOk && (
                        <SignerContext.Provider value={signer}>
                            <div>
                                <MarginAccountDashboard />
                            </div>
                            <div className="mt-4">
                                <TradingPerformanceDashboard />
                            </div>
                            <div className="mt-16">
                                <PositionsDashboard />
                            </div>
                            <div className="mt-16">
                                <TransactionHistory />
                            </div>
                        </SignerContext.Provider>
                    )}
                </div>
            )}
        </div>
    )
}
