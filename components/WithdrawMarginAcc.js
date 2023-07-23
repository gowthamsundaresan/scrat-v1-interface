import React, { useEffect, useState, useContext } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import { useTokenPrice } from "./GetTokenPrice"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
import { withCoalescedInvoke } from "next/dist/lib/coalesced-function"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")
const { abi: IPoolAddressesProviderABI } = require("../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../artifacts/IPool.json")

export const WithdrawMarginAcc = ({ closeWithdrawModal }) => {
    const signer = useContext(SignerContext)
    const { tokenPrices, pricesLoading } = useTokenPrice()
    const {
        polygonTickerToAddress,
        polygonTickerToAAddress,
        deFiContractToAddress,
        liquidationThresholds,
        loanToValues,
    } = useContext(PolygonAddressesContext)
    const [requestAmount, setRequestAmount] = useState("0")
    const [maxWithdraw, setMaxWithdraw] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newNetPosition, setNewNetPosition] = useState("")
    const [newMinNetPosition, setNewMinNetPosition] = useState("")
    const [transactionError, setTransactionError] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (
            signer &&
            !pricesLoading &&
            !polygonTickerToAddress &&
            !deFiContractToAddress &&
            !liquidationThresholds &&
            !loanToValues
        ) {
            setLoading(false)
        }
    }, [
        signer,
        pricesLoading,
        polygonTickerToAddress,
        deFiContractToAddress,
        liquidationThresholds,
        loanToValues,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
        }
    }, [
        signer,
        pricesLoading,
        polygonTickerToAddress,
        deFiContractToAddress,
        liquidationThresholds,
        loanToValues,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
            calculateNewData(signer)
        }
    }, [
        signer,
        pricesLoading,
        requestAmount,
        polygonTickerToAddress,
        deFiContractToAddress,
        liquidationThresholds,
        loanToValues,
    ])

    const calculateNewData = async (signer) => {
        // Addresses and Contracts
        const poolAddressesProviderAddress = deFiContractToAddress.PoolAddressesProvider
        const poolAddressesProviderContract = new ethers.Contract(
            poolAddressesProviderAddress,
            IPoolAddressesProviderABI,
            signer
        )
        const poolContractAddress = await poolAddressesProviderContract.getPool()

        // Fetch and Format Data
        let { totalCollateralBase, totalDebtBase, currentLiquidationThreshold } =
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

        let newLT =
            Number(currentLiquidationThreshold) *
                (Number(totalCollateralBase) /
                    (Number(totalCollateralBase) - Number(requestAmount))) -
            liquidationThresholds["USDC"] *
                (Number(requestAmount) / (Number(totalCollateralBase) - Number(requestAmount)))

        console.log("currentLiquidationThreshold", currentLiquidationThreshold.toString())
        console.log("newLT", newLT.toString())

        // Max Withdraw
        let max =
            (Number(totalCollateralBase) * Number(currentLiquidationThreshold) -
                1.05 * Number(totalDebtBase)) /
            liquidationThresholds["USDC"]

        max = max < 0 ? 0 : max
        setMaxWithdraw(Math.floor(Number(max) * 100) / 100)

        // New HF
        setNewHealthFactor(
            (
                ((Number(totalCollateralBase) - Number(requestAmount)) * Number(newLT)) /
                Number(totalDebtBase)
            ).toFixed(2)
        )
        // New NP
        setNewNetPosition(
            (Number(totalCollateralBase) - Number(requestAmount) - Number(totalDebtBase)).toFixed(2)
        )

        // Min NP
        setNewMinNetPosition(
            ((Number(totalDebtBase) * 1.05) / Number(newLT) - Number(totalDebtBase)).toFixed(2)
        )
    }

    const handleClick = async () => {
        // Init
        setLoading(true)
        setTransactionError(null)
        if (requestAmount <= 1) {
            setTransactionError("Min. withdraw amount is $1.")
            setLoading(false)
        } else {
            try {
                const sdk = ThirdwebSDK.fromSigner(signer)

                // Addresses
                const aUSDCAddress = polygonTickerToAAddress["USDC"]
                const crossMarginTradingAddress = deFiContractToAddress.CrossMarginTrading

                // Contracts
                const crossMarginTradingContract = await sdk.getContract(
                    crossMarginTradingAddress,
                    CrossMarginTradingABI,
                    signer
                )
                const aUSDCContract = await sdk.getContract(aUSDCAddress, ERC20ABI, signer)

                // Check aTokenBalance
                let balance = await aUSDCContract.call("balanceOf", [signer._address])

                // Make sure user has enough USDC aTokens
                let amountIn = 0
                if (requestAmount > balance) {
                    amountIn = ethers.utils.parseUnits(balance.toString(), 6)
                } else {
                    amountIn = ethers.utils.parseUnits(requestAmount.toString(), 6)
                }

                // Approvals
                let ap1 = await aUSDCContract.call("approve", [crossMarginTradingAddress, amountIn])

                // Call CrossMarginTrading.sol
                let tx1 = await crossMarginTradingContract.call("withdrawFromMarginAccount", [
                    amountIn,
                ])

                // Update Database
                let { data: accountDetails, error: error } = await supabase
                    .from("Margin Accounts")
                    .select("amount")
                    .eq("address", signer._address)

                const newAmount = Number(accountDetails[0].amount) - Number(requestAmount)

                const { data, error1 } = await supabase.from("Margin Accounts").upsert(
                    [
                        {
                            address: signer._address,
                            amount: newAmount,
                        },
                    ],
                    { onConflict: "address" }
                )

                const { data2, error2 } = await supabase
                    .from("Withdraw Actions")
                    .insert([
                        {
                            address: signer._address,
                            withdraw_amount: requestAmount,
                        },
                    ])
                    .select()

                // Close Popup
                closeWithdrawModal()
                window.location.reload()
            } catch (error) {
                console.log(error)
                setTransactionError("Error: " + error.reason)
            } finally {
                setLoading(false)
            }
        }
    }

    const shortenAddress = (address, startLength = 4, endLength = 4) => {
        let shortened = address

        if (address.length > startLength + endLength) {
            shortened = `${address.slice(0, startLength)}...${address.slice(-endLength)}`
        }

        return shortened
    }

    return (
        <div className="mt-8 grid grid-cols-2 gap-6 items-center">
            <div className="text-lg font-bold text-black col-span-2">
                Withdraw Funds from Margin Account
            </div>

            <div className="text-base font-regular text-black">Amount in USDC</div>
            <div>
                <input
                    type="number"
                    value={requestAmount}
                    max={Number(maxWithdraw)}
                    onChange={(e) => {
                        let newValue = e.target.value
                        if (
                            newValue === "" ||
                            (!isNaN(newValue) && newValue >= 0 && newValue <= Number(maxWithdraw))
                        ) {
                            setRequestAmount(newValue)
                        }
                    }}
                    placeholder="10 USDC"
                    className="bg-white text-black placeholder-black text-base placeholder-opacity-40 p-2.5 border-b-2 border-black"
                ></input>
                <button
                    onClick={() => {
                        setRequestAmount(maxWithdraw)
                    }}
                    className="text-black text-sm ml-2"
                >
                    MAX
                </button>
            </div>

            <div className="text-base font-regular text-black">Wallet Address</div>
            <div className="text-base font-regular text-slate-400">
                {shortenAddress(signer._address)}
            </div>

            <div className="text-base font-regular text-black">New Health Factor</div>
            <div className="text-base font-regular text-black">{newHealthFactor}</div>

            <div className="text-base font-regular text-black">New Net Position</div>
            <div className="text-base font-regular text-black">${newNetPosition}</div>

            <div className="text-base font-regular text-black">Min. Net Position</div>
            <div className="text-base font-regular text-black">${newMinNetPosition}</div>

            <div
                onClick={loading ? null : handleClick}
                className={`flex text-base justify-center items-center text-black ${
                    loading
                        ? "bg-zinc-700 text-white"
                        : "bg-white hover:text-white hover:bg-zinc-900"
                } px-6 py-4 rounded-lg mt-4 col-span-2 cursor-${loading ? "default" : "pointer"}`}
            >
                {loading ? "Loading..." : "Confirm"}
            </div>
            {transactionError && <div className="text-red-500 text-xs">{transactionError}</div>}
        </div>
    )
}
