import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { DepositMarginAcc } from "./DepositMarginAcc"
import { WithdrawMarginAcc } from "./WithdrawMarginAcc"
import { useTokenPrice } from "./GetTokenPrice"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
const { ethers } = require("ethers")

// Artifacts
const { abi: IPoolAddressesProviderABI } = require("../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../artifacts/IPool.json")

export const MarginAccountDashboard = () => {
    const signer = useContext(SignerContext)
    const { tokenPrices, pricesLoading } = useTokenPrice()
    const { polygonTickerToAddress, deFiContractToAddress } = useContext(PolygonAddressesContext)

    const [healthFactor, setHealthFactor] = useState("Loading")
    const [netPosition, setNetPosition] = useState(" Loading")
    const [minNetPosition, setMinNetPosition] = useState(" Loading")
    const [isDepositModalOpen, setDepositModalOpen] = useState(false)
    const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    console.log("--------------------------")
    console.log("signer: ", signer)
    console.log("pricesLoading: ", pricesLoading.toString())
    console.log("polygonTickerToAddress: ", polygonTickerToAddress)
    console.log("deFiContractToAddress: ", deFiContractToAddress)
    console.log("--------------------------")

    /* useEffect(() => {
        if (signer && !pricesLoading && polygonTickerToAddress && deFiContractToAddress) {
            console.log("UseEffect 1")
            setLoading(false)
        }
    }, [signer, pricesLoading, polygonTickerToAddress, deFiContractToAddress]) */

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            console.log("UseEffect 2")
            fetchData(signer)
        }
    }, [signer, tokenPrices, polygonTickerToAddress, deFiContractToAddress])

    const fetchData = async (signer) => {
        console.log("Fetchdata")
        // Addresses and Contracts
        const poolAddressesProviderAddress = deFiContractToAddress.PoolAddressesProvider
        const poolAddressesProviderContract = new ethers.Contract(
            poolAddressesProviderAddress,
            IPoolAddressesProviderABI,
            signer
        )
        const poolContractAddress = await poolAddressesProviderContract.getPool()

        // Fetch and Format Data
        let { totalCollateralBase, totalDebtBase, currentLiquidationThreshold, healthFactor } =
            await new ethers.Contract(poolContractAddress, IPoolABI, signer).getUserAccountData(
                signer._address
            )

        totalCollateralBase = ethers.utils.formatUnits(totalCollateralBase.toString(), 8)
        totalDebtBase = ethers.utils.formatUnits(totalDebtBase.toString(), 8)
        currentLiquidationThreshold = ethers.utils.formatUnits(
            currentLiquidationThreshold.toString(),
            2
        )
        currentLiquidationThreshold = Number(currentLiquidationThreshold) / 100
        healthFactor = ethers.utils.formatUnits(healthFactor.toString(), 18)

        // Calculate
        const netPositionBase = Number(totalCollateralBase) - Number(totalDebtBase)
        const minNetPositionBase =
            (Number(totalDebtBase) * 1.05) / currentLiquidationThreshold - Number(totalDebtBase)

        // Set Final Data
        setNetPosition(netPositionBase.toFixed(2))
        setMinNetPosition(
            minNetPositionBase > 0 ? minNetPositionBase.toFixed(2) : Number(0).toFixed(2)
        )
        setHealthFactor(healthFactor < 10000000 ? Number(healthFactor).toFixed(2) : "NA")
    }

    return (
        <div className="border-2 border-black rounded-lg px-8 py-8 bg-scrat-gray">
            <div className="flex flex-row">
                <div className="flex flex-row justify-between items-center w-full">
                    <div className="text-2xl font-bold text-white">Margin Account Dashboard</div>
                    <div className="flex space-x-2">
                        <div
                            onClick={() => setDepositModalOpen(true)}
                            className="text-sm text-black bg-white hover:text-white hover:bg-zinc-700 px-6 py-4 rounded-lg"
                        >
                            Deposit Funds +
                        </div>
                        <div
                            onClick={() => setWithdrawModalOpen(true)}
                            className="text-sm text-black bg-white hover:text-white hover:bg-zinc-700 px-6 py-4 rounded-lg"
                        >
                            Withdraw Funds
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-6 mt-4">
                <div>
                    <div className="text-sm font-regular text-white mt-4">Net Position</div>
                    <div className="text-lg font-bold text-white mt-2">${netPosition}</div>
                </div>
                <div>
                    <div className="text-sm font-regular text-white mt-4">Min. Net Position </div>
                    <div className="text-lg font-bold text-white mt-2">${minNetPosition}</div>
                </div>
                <div>
                    <div className="text-sm font-regular text-white mt-4">Health Factor</div>
                    <div className="text-lg font-bold text-white mt-2">{healthFactor}</div>
                </div>
            </div>
            {isDepositModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setDepositModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <DepositMarginAcc closeDepositModal={() => setDepositModalOpen(false)} />
                    </div>
                </div>
            )}
            {isWithdrawModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setWithdrawModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <WithdrawMarginAcc closeWithdrawModal={() => setWithdrawModalOpen(false)} />
                    </div>
                </div>
            )}
        </div>
    )
}
