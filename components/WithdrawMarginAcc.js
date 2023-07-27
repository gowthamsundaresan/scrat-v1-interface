import React, { useEffect, useState, useContext } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import {
    polygonTickerToAAddress,
    deFiContractToAddress,
    liquidationThresholds,
} from "../lib/polygonAddresses"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")

export const WithdrawMarginAcc = ({ closeWithdrawModal }) => {
    const signer = useContext(SignerContext)

    const [tokenPrices, setTokenPrices] = useState([])
    const [requestAmount, setRequestAmount] = useState("0")
    const [maxWithdraw, setMaxWithdraw] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newNetPosition, setNewNetPosition] = useState("")
    const [newMinNetPosition, setNewMinNetPosition] = useState("")
    const [transactionError, setTransactionError] = useState(null)
    const [isOverMax, setIsOverMax] = useState(false)
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
                const { totalCollateralBase, totalDebtBase, currentLiquidationThreshold } =
                    await res.json()

                let newLT =
                    Number(currentLiquidationThreshold) *
                        (Number(totalCollateralBase) /
                            (Number(totalCollateralBase) - Number(requestAmount))) -
                    liquidationThresholds["USDC"] *
                        (Number(requestAmount) /
                            (Number(totalCollateralBase) - Number(requestAmount)))

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
                    (
                        Number(totalCollateralBase) -
                        Number(requestAmount) -
                        Number(totalDebtBase)
                    ).toFixed(2)
                )

                // Min NP
                setNewMinNetPosition(
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
                <div className="flex items-center">
                    <input
                        type="number"
                        value={requestAmount}
                        max={Number(maxWithdraw)}
                        onChange={(e) => {
                            let newValue = e.target.value
                            if (newValue === "" || (!isNaN(newValue) && newValue >= 0)) {
                                setRequestAmount(newValue)
                                setIsOverMax(false)
                            }
                            if (Number(newValue) > Number(maxWithdraw)) {
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
                            setRequestAmount(maxWithdraw)
                            setIsOverMax(false)
                        }}
                        className="text-black text-sm ml-2"
                    >
                        MAX
                    </button>
                </div>
                {isOverMax && (
                    <div className="text-red-500 text-xs mt-2">
                        Max withdraw possible is ${maxWithdraw}
                    </div>
                )}
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
