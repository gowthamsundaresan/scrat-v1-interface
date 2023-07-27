import React, { useEffect, useState, useContext } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import {
    polygonTickerToAddress,
    deFiContractToAddress,
    liquidationThresholds,
} from "../lib/polygonAddresses"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")

export const DepositMarginAcc = ({ closeDepositModal }) => {
    const signer = useContext(SignerContext)

    const [tokenPrices, setTokenPrices] = useState([])
    const [requestAmount, setRequestAmount] = useState("")
    const [maxDeposit, setMaxDeposit] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newNetPosition, setNewNetPosition] = useState("")
    const [minNetPosition, setMinNetPosition] = useState("")
    const [isOverMax, setIsOverMax] = useState(false)
    const [transactionError, setTransactionError] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPrices = async () => {
            const res = await fetch("/api/prices")
            const prices = await res.json()
            setTokenPrices(prices)
        }

        fetchPrices()

        const intervalId = setInterval(fetchPrices, 20000)

        return () => {
            clearInterval(intervalId)
        }
    }, [])

    useEffect(() => {
        if (signer && Object.keys(tokenPrices).length > 0) {
            setLoading(false)
        }
    }, [signer, tokenPrices])

    useEffect(() => {
        const fetchUserAccountData = async () => {
            const res = await fetch("/api/userdata", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    signerAddress: signer._address,
                    poolAddressesProviderAddress: deFiContractToAddress.PoolAddressesProvider,
                }),
            })

            if (res.ok) {
                const {
                    totalCollateralBase,
                    totalDebtBase,
                    currentLiquidationThreshold,
                    usdBalance,
                } = await res.json()

                let newLT =
                    Number(currentLiquidationThreshold) *
                        (Number(totalCollateralBase) /
                            (Number(totalCollateralBase) + Number(requestAmount))) +
                    liquidationThresholds["USDC"] *
                        (Number(requestAmount) /
                            (Number(totalCollateralBase) + Number(requestAmount)))

                // Max Deposit
                setMaxDeposit(usdBalance)

                // New HF
                setNewHealthFactor(
                    (
                        ((Number(totalCollateralBase) + Number(requestAmount)) * Number(newLT)) /
                        Number(totalDebtBase)
                    ).toFixed(2)
                )
                // New NP
                setNewNetPosition(
                    (
                        Number(totalCollateralBase) +
                        Number(requestAmount) -
                        Number(totalDebtBase)
                    ).toFixed(2)
                )

                // Min NP
                setMinNetPosition(
                    (
                        (Number(totalDebtBase) * 1.05) / Number(newLT) -
                        Number(totalDebtBase)
                    ).toFixed(2)
                )
            }
        }

        if (signer && Object.keys(tokenPrices).length > 0) {
            fetchUserAccountData()
            setLoading(false)
        }
    }, [signer, tokenPrices, requestAmount])

    const handleClick = async () => {
        // Init
        setLoading(true)
        setTransactionError(null)
        if (requestAmount <= 1) {
            setTransactionError("Min. deposit amount is $1.")
            setLoading(false)
        } else {
            try {
                const sdk = ThirdwebSDK.fromSigner(signer)
                const amountIn = ethers.utils.parseUnits(requestAmount.toString(), 6)

                // Addresses
                const usdcAddress = polygonTickerToAddress["USDC"]
                const crossMarginTradingAddress = deFiContractToAddress.CrossMarginTrading

                // Contracts
                const crossMarginTradingContract = await sdk.getContract(
                    crossMarginTradingAddress,
                    CrossMarginTradingABI,
                    signer
                )
                const usdcContract = await sdk.getContract(usdcAddress, ERC20ABI, signer)

                // Approvals
                let ap1 = await usdcContract.call("approve", [crossMarginTradingAddress, amountIn])

                // Call CrossMarginTrading.sol
                let tx1 = await crossMarginTradingContract.call("depositIntoMarginAccount", [
                    amountIn,
                ])

                // Update Database
                let { data: accountDetails, error: error } = await supabase
                    .from("Margin Accounts")
                    .select("amount")
                    .eq("address", signer._address)

                const newAmount = accountDetails[0]
                    ? Number(accountDetails[0].amount) + Number(requestAmount)
                    : Number(requestAmount)

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
                    .from("Deposit Actions")
                    .insert([
                        {
                            address: signer._address,
                            deposit_amount: requestAmount,
                        },
                    ])
                    .select()

                // Close Popup
                closeDepositModal()
                window.location.reload()
            } catch (error) {
                console.log(error)
                setTransactionError("Error: " + error.reason)
            } finally {
                setLoading(false)
            }
        }
    }

    return (
        <div className="mt-8 grid grid-cols-2 gap-6 items-center">
            <div className="text-lg font-bold text-black col-span-2">
                Deposit Funds into Margin Account
            </div>

            <div className="text-base font-regular text-black">Amount in USDC</div>
            <div>
                <div className="flex items-center">
                    <input
                        type="number"
                        value={requestAmount}
                        max={Number(maxDeposit)}
                        onChange={(e) => {
                            let newValue = e.target.value
                            if (newValue === "" || (!isNaN(newValue) && newValue >= 0)) {
                                setRequestAmount(newValue)
                                setIsOverMax(false)
                            }
                            if (Number(newValue) > Number(maxDeposit)) {
                                setIsOverMax(true)
                            }
                        }}
                        placeholder="10 USDC"
                        className={`bg-white placeholder-black text-base placeholder-opacity-40 p-2.5 border-b-2 ${
                            isOverMax ? "text-red-500 border-red-500" : "text-black border-black"
                        }`}
                    ></input>

                    <button
                        onClick={() => {
                            setRequestAmount(maxDeposit)
                            setIsOverMax(false)
                        }}
                        className="text-black text-sm ml-2"
                    >
                        MAX
                    </button>
                </div>
                {isOverMax && (
                    <div className="text-red-500 text-xs mt-2">
                        Amount in wallet is ${maxDeposit}
                    </div>
                )}
            </div>

            <div className="text-base font-regular text-black">New Health Factor</div>
            <div className="text-base font-regular text-black">{newHealthFactor}</div>

            <div className="text-base font-regular text-black">New Net Position</div>
            <div className="text-base font-regular text-black">${newNetPosition}</div>

            <div className="text-base font-regular text-black">Min. Net Position</div>
            <div className="text-base font-regular text-black">${minNetPosition}</div>

            <div
                onClick={loading || isOverMax ? null : handleClick}
                className={`flex text-base justify-center items-center text-black ${
                    loading
                        ? "bg-zinc-700 text-white"
                        : isOverMax
                        ? "cursor-not-allowed opacity-50 bg-white text-black"
                        : "bg-white hover:text-white hover:bg-zinc-900"
                } px-6 py-4 rounded-lg mt-4 col-span-2 cursor-${loading ? "default" : "pointer"}`}
            >
                {loading ? "Loading..." : "Confirm"}
            </div>
            {transactionError && (
                <div
                    className="text-red-500 text-xs overflow-hidden text-overflow-ellipsis white-space-nowrap w-full"
                    style={{ maxWidth: "100%" }}
                >
                    {transactionError.length > 100
                        ? transactionError.substring(0, 100) + "..."
                        : transactionError}
                </div>
            )}
        </div>
    )
}
