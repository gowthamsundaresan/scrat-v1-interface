import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import {
    polygonTickerToAddress,
    polygonTickerToAAddress,
    deFiContractToAddress,
    liquidationThresholds,
} from "../lib/polygonAddresses"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")

export const CloseShortPosition = ({ id, ticker, current, closeCloseShortModal }) => {
    const signer = useContext(SignerContext)

    const [tokenPrices, setTokenPrices] = useState([])
    const [requestAmount, setRequestAmount] = useState("")
    const [tokenPrice, setTokenPrice] = useState("")
    const [profit, setProfit] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newMinNetPosition, setNewMinNetPosition] = useState("")
    const [isOverMaxPositionSize, setIsOverMaxPositionSize] = useState(false)
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
            calculateConstantData(signer)
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
                    (Number(currentLiquidationThreshold) * Number(totalCollateralBase)) /
                        (Number(totalCollateralBase) - Number(requestAmount)) -
                    (Number(requestAmount) * liquidationThresholds["USDC"]) /
                        (Number(totalCollateralBase) - Number(requestAmount))

                // New HF
                setNewHealthFactor(
                    (
                        ((Number(totalCollateralBase) - Number(requestAmount)) * Number(newLT)) /
                        (Number(totalDebtBase) - Number(requestAmount))
                    ).toFixed(2)
                )

                // New Min NP
                setNewMinNetPosition(
                    (
                        ((Number(totalDebtBase) - Number(requestAmount)) * 1.05) / Number(newLT) -
                        (Number(totalDebtBase) - Number(requestAmount))
                    ).toFixed(2)
                )
            }
        }

        if (signer && Object.keys(tokenPrices).length > 0) {
            fetchUserAccountData()
            setLoading(false)
        }
    }, [signer, tokenPrices, requestAmount])

    const calculateConstantData = async (signer) => {
        // Get row of position_id from Open Actions
        let { data: positionData, error: error1 } = await supabase
            .from("Open Actions")
            .select("open_price,current_size")
            .eq("id", id)

        let openPrice = Number(positionData[0].open_price)
        let currentSizeBase = Number(positionData[0].current_size)
        let tokenPrice = Number(tokenPrices[ticker])

        let open = currentSizeBase * openPrice
        let current = currentSizeBase * tokenPrice
        let pAndL = current - open

        // Token Price
        setTokenPrice(tokenPrices[ticker].toString())

        // Latest Profit
        setProfit(Math.floor(pAndL * 1000) / 1000)
    }

    const handleClick = async () => {
        // Setup
        setLoading(true)
        setTransactionError(null)
        if (requestAmount <= 0.5) {
            setTransactionError("Min. position size is $0.5.")
            setLoading(false)
        } else {
            try {
                const sdk = ThirdwebSDK.fromSigner(signer)
                const direction = 3
                const positionId = id
                let isActive = true
                let repayConverted = 0
                let profitConverted = Number(profit) > 0 ? Number(profit) : 0
                let approvalAmount = Math.floor(requestAmount * 100000000) / 100000000
                let closeSize = requestAmount / tokenPrices[ticker]
                closeSize = Math.floor(closeSize * 1000000) / 1000000

                repayConverted = ethers.utils.parseUnits(
                    (approvalAmount - profitConverted).toString(),
                    6
                )
                profitConverted = ethers.utils.parseUnits(profitConverted.toString(), 6)
                approvalAmount = ethers.utils.parseUnits(approvalAmount.toString(), 6)

                // Addresses
                const tokenAddress = polygonTickerToAddress[ticker]
                const usdcAddress = polygonTickerToAddress["USDC"]
                const aUSDCAddress = polygonTickerToAAddress["USDC"]
                const crossMarginTradingAddress = deFiContractToAddress.CrossMarginTrading

                // Contracts
                const crossMarginTradingContract = await sdk.getContract(
                    crossMarginTradingAddress,
                    CrossMarginTradingABI,
                    signer
                )
                const usdcContract = await sdk.getContract(usdcAddress, ERC20ABI, signer)
                const aUSDCContract = await sdk.getContract(aUSDCAddress, ERC20ABI, signer)

                // Approvals
                let ap1 = await usdcContract.call("approve", [
                    crossMarginTradingAddress,
                    approvalAmount,
                ])
                let ap2 = await aUSDCContract.call("approve", [
                    crossMarginTradingAddress,
                    approvalAmount,
                ])

                // Call CrossMarginTrading.sol
                let tx1 = await crossMarginTradingContract.call("requestClose", [
                    repayConverted,
                    tokenAddress,
                    direction,
                    profitConverted,
                ])

                // Get row of position_id from Open Actions
                let { data: positionData, error: error1 } = await supabase
                    .from("Open Actions")
                    .select("current_size")
                    .eq("id", positionId)

                let currentSize = Number(positionData[0].current_size)

                // Calculate currentSize
                currentSize = currentSize - closeSize
                if (currentSize * tokenPrices[ticker] <= 0.51) {
                    currentSize = 0
                    isActive = false
                }

                // Update row position_id for currentSize in Open Actions
                const { data: data2, error: error2 } = await supabase
                    .from("Open Actions")
                    .update([
                        {
                            current_size: currentSize,
                            is_active: isActive,
                        },
                    ])
                    .eq("id", positionId)

                // Update data for Close Actions
                const { data, error } = await supabase
                    .from("Close Actions")
                    .insert([
                        {
                            position_id: positionId,
                            close_size: closeSize,
                            close_price: tokenPrices[ticker],
                            p_and_l: profit,
                        },
                    ])
                    .select()

                // Close Popup
                closeCloseShortModal()
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
            <div className="text-lg font-bold text-black col-span-2">Close Short Position</div>

            <div className="text-base font-regular text-black">Asset</div>
            <div className="text-base font-regular text-black">{ticker}</div>

            <div className="text-base font-regular text-black">Current Token Price</div>
            <div className="text-base font-regular text-black">${tokenPrice}</div>

            <div className="text-base font-regular text-black">Current Position</div>
            <div className="text-base font-regular text-black">${current}</div>

            <div className="text-base font-regular text-black">Current P/L</div>
            <div className="text-base font-regular text-black">${profit}</div>

            <div className="text-base font-regular text-black">Amount to Close (USDC)</div>
            <div>
                <div className="flex items-center">
                    <input
                        type="number"
                        value={requestAmount}
                        max={Number(current)}
                        onChange={(e) => {
                            let newValue = e.target.value
                            if (newValue === "" || (!isNaN(newValue) && newValue >= 0)) {
                                setRequestAmount(newValue)
                                setIsOverMaxPositionSize(false)
                            }
                            if (Number(newValue) > Number(current)) {
                                setIsOverMaxPositionSize(true)
                            }
                        }}
                        placeholder="10 USDC"
                        className={`bg-white placeholder-black text-base placeholder-opacity-40 p-2.5 border-b-2 ${
                            isOverMaxPositionSize
                                ? "text-red-500 border-red-500"
                                : "text-black border-black"
                        }`}
                    ></input>

                    <button
                        onClick={() => {
                            setRequestAmount(Number(current))
                            setIsOverMaxPositionSize(false)
                        }}
                        className="text-black text-sm ml-2"
                        style={{ width: "50px" }}
                    >
                        MAX
                    </button>
                </div>

                {isOverMaxPositionSize && (
                    <div className="text-red-500 text-xs mt-2">
                        Maximum position size is {current}
                    </div>
                )}
            </div>

            <div className="text-base font-regular text-black ">New Health Factor</div>
            <div className="text-base font-regular text-black ">{newHealthFactor}</div>

            <div className="text-base font-regular text-black">New Min. Net Position</div>
            <div className="text-base font-regular text-black">${newMinNetPosition}</div>

            <div
                onClick={loading || isOverMaxPositionSize ? null : handleClick}
                className={`flex text-base justify-center items-center text-black ${
                    loading
                        ? "bg-zinc-700 text-white"
                        : isOverMaxPositionSize
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
