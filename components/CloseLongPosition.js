import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import { useTokenPrice } from "./GetTokenPrice"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")
const { abi: IPoolAddressesProviderABI } = require("../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../artifacts/IPool.json")

export const CloseLongPosition = ({ id, ticker, current, closeCloseLongModal }) => {
    const signer = useContext(SignerContext)
    const { tokenPrices, pricesLoading } = useTokenPrice()
    const {
        polygonTickerToAddress,
        polygonTickerToAAddress,
        deFiContractToAddress,
        liquidationThresholds,
    } = useContext(PolygonAddressesContext)

    const [requestAmount, setRequestAmount] = useState("")
    const [tokenPrice, setTokenPrice] = useState("")
    const [profit, setProfit] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newMinNetPosition, setNewMinNetPosition] = useState("")
    const [isOverMaxPositionSize, setIsOverMaxPositionSize] = useState(false)
    const [transactionError, setTransactionError] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (
            signer &&
            !pricesLoading &&
            !polygonTickerToAddress &&
            !polygonTickerToAAddress &&
            !deFiContractToAddress &&
            !liquidationThresholds
        ) {
            setLoading(false)
        }
    }, [
        signer,
        pricesLoading,
        polygonTickerToAddress,
        polygonTickerToAAddress,
        deFiContractToAddress,
        liquidationThresholds,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(polygonTickerToAAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
            calculateConstantData(signer)
        }
    }, [
        signer,
        tokenPrices,
        polygonTickerToAddress,
        polygonTickerToAAddress,
        deFiContractToAddress,
        liquidationThresholds,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(polygonTickerToAAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
            calculateNewData(signer)
        }
    }, [
        signer,
        requestAmount,
        polygonTickerToAddress,
        polygonTickerToAAddress,
        deFiContractToAddress,
        liquidationThresholds,
    ])

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

        // New HF
        let newLT =
            (Number(currentLiquidationThreshold) * Number(totalCollateralBase)) /
                (Number(totalCollateralBase) - Number(requestAmount)) -
            (Number(requestAmount) * liquidationThresholds[ticker]) /
                (Number(totalCollateralBase) - Number(requestAmount))

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
                const direction = 2
                const positionId = id
                const closeSize = requestAmount / tokenPrices[ticker]
                let isActive = true
                let repayConverted = 0
                let profitConverted = Number(profit) > 0 ? Number(profit) / tokenPrices[ticker] : 0
                profitConverted = Math.floor(profitConverted * 1000) / 1000
                let totalPositionConverted = requestAmount / tokenPrices[ticker]
                totalPositionConverted = Math.floor(totalPositionConverted * 100000000) / 100000000

                // Addresses
                const tokenAddress = polygonTickerToAddress[ticker]
                const aTokenAddress = polygonTickerToAAddress[ticker]
                const crossMarginTradingAddress = deFiContractToAddress.CrossMarginTrading

                // Contracts
                const crossMarginTradingContract = await sdk.getContract(
                    crossMarginTradingAddress,
                    CrossMarginTradingABI,
                    signer
                )
                const tokenContract = await sdk.getContract(tokenAddress, ERC20ABI, signer)
                const aTokenContract = await sdk.getContract(aTokenAddress, ERC20ABI, signer)

                // Check aTokenBalance
                let balance = await aTokenContract.call("balanceOf", [signer._address])

                if (ticker != "WBTC") {
                    balance = ethers.utils.formatUnits(balance.toString(), 18)
                    balance = Math.floor(balance * 100000000) / 100000000
                    if (totalPositionConverted > balance) {
                        repayConverted = ethers.utils.parseUnits(
                            (balance - profitConverted).toString(),
                            18
                        )
                        totalPositionConverted = ethers.utils.parseUnits(balance.toString(), 18)
                    } else {
                        repayConverted = ethers.utils.parseUnits(
                            (totalPositionConverted - profitConverted).toString(),
                            18
                        )
                        totalPositionConverted = ethers.utils.parseUnits(
                            totalPositionConverted.toString(),
                            18
                        )
                    }
                    profitConverted = ethers.utils.parseUnits(profitConverted.toString(), 18)
                } else {
                    balance = ethers.utils.formatUnits(balance.toString(), 8)
                    balance = Math.floor(balance * 100000000) / 100000000
                    if (totalPositionConverted > balance) {
                        totalPositionConverted = Math.floor(balance * 100000000) / 100000000
                        repayConverted = ethers.utils.parseUnits(
                            (totalPositionConverted - profitConverted).toString(),
                            8
                        )
                        totalPositionConverted = ethers.utils.parseUnits(
                            totalPositionConverted.toString(),
                            8
                        )
                    } else {
                        totalPositionConverted =
                            Math.floor(totalPositionConverted * 100000000) / 100000000
                        repayConverted = ethers.utils.parseUnits(
                            (totalPositionConverted - profitConverted).toString(),
                            8
                        )
                        totalPositionConverted = ethers.utils.parseUnits(
                            totalPositionConverted.toString(),
                            8
                        )
                    }
                    profitConverted = ethers.utils.parseUnits(profitConverted.toString(), 8)
                }

                // Approvals
                let ap1 = await tokenContract.call("approve", [
                    crossMarginTradingAddress,
                    totalPositionConverted,
                ])

                let ap2 = await aTokenContract.call("approve", [
                    crossMarginTradingAddress,
                    totalPositionConverted,
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
                closeCloseLongModal()
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
            <div className="text-lg font-bold text-black col-span-2">Close Long Position</div>

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
            {transactionError && <div className="text-red-500 text-xs">{transactionError}</div>}
        </div>
    )
}
