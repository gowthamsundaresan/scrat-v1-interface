import React, { useState } from "react"
import NavBar from "@/components/NavBar"
import { ConnectWallet, useSigner } from "@thirdweb-dev/react"
import { SignerContext } from "../contexts/SignerContext"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
import { MarginAccountDashboard } from "@/components/MarginAccountDashboard"
import { PositionsDashboard } from "@/components/PositionsDashboard"
import { TradingPerformanceDashboard } from "@/components/TradingPerformanceDashboard"
import { TransactionHistory } from "@/components/TransactionHistory"

export default function index() {
    const signer = useSigner()
    const [polygonTickerToAddress, setPolygonTickerToAddress] = useState({
        USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        WMATIC: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        WBTC: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
        stMATIC: "0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4",
        LINK: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
    })
    const [polygonTickerToVAddress, setPolygonTickerToVAddress] = useState({
        USDC: "0xFCCf3cAbbe80101232d343252614b6A3eE81C989",
        WMATIC: "0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8",
        WETH: "0x0c84331e39d6658Cd6e6b9ba04736cC4c4734351",
        WBTC: "0x92b42c66840C7AD907b4BF74879FF3eF7c529473",
        LINK: "0x953A573793604aF8d41F306FEb8274190dB4aE0e",
    })
    const [polygonTickerToAAddress, setPolygonTickerToAAddress] = useState({
        USDC: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
        WMATIC: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
        WETH: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
        WBTC: "0x078f358208685046a11C85e8ad32895DED33A249",
        stMATIC: "0xEA1132120ddcDDA2F119e99Fa7A27a0d036F7Ac9",
        LINK: "0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530",
    })

    const [deFiContractToAddress, setDeFiContractToAddress] = useState({
        CrossMarginTrading: "0x54f7D6379BAe2A245Dcc86E709f89835116bF202",
        // CrossMarginTrading: "0x11e73abC581190B9fe31B804a5877aB5C2754C64", // Testing
        PoolAddressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
        Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        SwapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
        WMATICUSDCPool: "0xA374094527e1673A86dE625aa59517c5dE346d32",
    })

    const [liquidationThresholds, setLiquidationThresholds] = useState({
        USDC: 0.85,
        WMATIC: 0.73,
        WETH: 0.825,
        WBTC: 0.78,
        stMATIC: 0.65,
        LINK: 0.68,
    })

    const [loanToValues, setLoanToValues] = useState({
        USDC: 0.825,
        WMATIC: 0.68,
        WETH: 0.8,
        WBTC: 0.73,
        stMATIC: 0.5,
        LINK: 0.53,
    })

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
                    <SignerContext.Provider value={signer}>
                        <PolygonAddressesContext.Provider
                            value={{
                                polygonTickerToAddress,
                                setPolygonTickerToAddress,
                                polygonTickerToVAddress,
                                setPolygonTickerToVAddress,
                                polygonTickerToAAddress,
                                setPolygonTickerToAAddress,
                                deFiContractToAddress,
                                setDeFiContractToAddress,
                                liquidationThresholds,
                                setLiquidationThresholds,
                                loanToValues,
                                setLoanToValues,
                            }}
                        >
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
                        </PolygonAddressesContext.Provider>
                    </SignerContext.Provider>
                </div>
            )}
        </div>
    )
}
