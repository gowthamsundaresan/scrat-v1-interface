import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import {
    polygonTickerToAddress,
    polygonTickerToVAddress,
    deFiContractToAddress,
    liquidationThresholds,
    loanToValues,
} from "../lib/polygonAddresses"
const { ethers } = require("ethers")

// Artifacts
const { abi: VariableDebtTokenABI } = require("../artifacts/VariableDebtToken.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")

export const OpenShortPosition = ({ closeOpenShortModal }) => {
    const direction = 1
    const signer = useContext(SignerContext)

    const [netInterestRates, setNetInterestRates] = useState([])
    const [tokenPrices, setTokenPrices] = useState([])
    const [requestAmount, setRequestAmount] = useState("0")
    const [tokenPrice, setTokenPrice] = useState("")
    const [maxPositionSize, setMaxPositionSize] = useState("")
    const [newHealthFactor, setNewHealthFactor] = useState("")
    const [newMinNetPosition, setNewMinNetPosition] = useState("")
    const [selectedAsset, setSelectedAsset] = useState("WMATIC")
    const [interest, setInterest] = useState("")
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
        const fetchRates = async () => {
            const res = await fetch("/api/interest")
            const rates = await res.json()
            setNetInterestRates(rates)
        }

        fetchRates()

        const intervalId = setInterval(fetchRates, 300000)

        return () => {
            clearInterval(intervalId)
        }
    }, [])

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

                // Token Price
                setTokenPrice(tokenPrices[selectedAsset].toString())

                // New Max Position Size
                let max =
                    (totalDebtBase * 1.05 - totalCollateralBase * currentLiquidationThreshold) /
                    (loanToValues["USDC"] - 1.05)

                max = max < 0 ? 0 : max
                setMaxPositionSize(Math.floor(Number(max) * 100) / 100)

                // Interest
                setInterest(netInterestRates["WMATIC"].netInterestRateShort)
            }
        }

        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(netInterestRates).length > 0
        ) {
            fetchUserAccountData()
        }
    }, [signer, tokenPrices, netInterestRates, selectedAsset])

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

                // Token Price
                setTokenPrice(Number(tokenPrices[selectedAsset]).toFixed(3).toString())

                // New HF
                let newLT =
                    Number(currentLiquidationThreshold) *
                        (Number(totalCollateralBase) /
                            (Number(totalCollateralBase) + Number(requestAmount))) +
                    liquidationThresholds["USDC"] *
                        (Number(requestAmount) /
                            (Number(totalCollateralBase) + Number(requestAmount)))

                setNewHealthFactor(
                    (
                        ((Number(totalCollateralBase) + Number(requestAmount)) * Number(newLT)) /
                        (Number(totalDebtBase) + Number(requestAmount))
                    ).toFixed(2)
                )

                // New Min NP
                setNewMinNetPosition(
                    (
                        ((Number(totalDebtBase) + Number(requestAmount)) * 1.1) / Number(newLT) -
                        (Number(totalDebtBase) + Number(requestAmount))
                    ).toFixed(2)
                )

                // Interest
                setInterest(netInterestRates[selectedAsset].netInterestRateShort)
            }
        }

        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(netInterestRates).length > 0
        ) {
            fetchUserAccountData()
            setLoading(false)
        }
    }, [signer, tokenPrices, requestAmount, selectedAsset])

    const handleSelectChange = (e) => {
        setSelectedAsset(e.target.value)
    }

    const handleClick = async () => {
        // Init
        setLoading(true)
        setTransactionError(null)

        if (requestAmount < 1) {
            setTransactionError("Min. position size is $1.")
            setLoading(false)
        } else {
            try {
                const sdk = ThirdwebSDK.fromSigner(signer)
                let openSize = requestAmount / tokenPrices[selectedAsset]
                let amountIn = requestAmount / tokenPrices[selectedAsset]
                let delegationApproval = (requestAmount * 1.1) / tokenPrices[selectedAsset]

                if (selectedAsset != "WBTC") {
                    amountIn = ethers.utils.parseUnits(amountIn.toString(), 18)
                    delegationApproval = ethers.utils.parseUnits(amountIn.toString(), 18)
                } else {
                    amountIn = Math.floor(amountIn * 100000000) / 100000000
                    amountIn = ethers.utils.parseUnits(amountIn.toString(), 8)
                    delegationApproval = ethers.utils.parseUnits(amountIn.toString(), 8)
                }

                // Addresses
                const tokenAddress = polygonTickerToAddress[selectedAsset]
                const vTokenAddress = polygonTickerToVAddress[selectedAsset]
                const crossMarginTradingAddress = deFiContractToAddress.CrossMarginTrading

                // Contracts
                const crossMarginTradingContract = await sdk.getContract(
                    crossMarginTradingAddress,
                    CrossMarginTradingABI,
                    signer
                )

                const vTokenCreditDelegationContract = new ethers.Contract(
                    vTokenAddress,
                    VariableDebtTokenABI,
                    signer
                )

                // Approvals
                let ap1 = await vTokenCreditDelegationContract.approveDelegation(
                    crossMarginTradingAddress,
                    delegationApproval
                )

                // Call CrossMarginTrading.sol
                let tx1 = await crossMarginTradingContract.call("requestOpen", [
                    amountIn,
                    tokenAddress,
                    direction,
                ])

                // Update Database
                const { data, error } = await supabase
                    .from("Open Actions")
                    .insert([
                        {
                            address: signer._address,
                            asset: tokenAddress,
                            direction: direction,
                            open_size: openSize,
                            open_price: tokenPrices[selectedAsset],
                            current_size: openSize,
                            is_active: true,
                        },
                    ])
                    .select()

                // Close Popup
                closeOpenShortModal()
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
            <div className="text-lg font-bold text-black col-span-2">Open Short Position</div>

            <div className="text-base font-regular text-black">Choose Asset</div>
            <div className="text-base font-regular text-black">
                <select
                    className="p-3 rounded-lg"
                    value={selectedAsset}
                    onChange={handleSelectChange}
                >
                    {Object.keys(polygonTickerToAddress)
                        .filter((ticker) => ticker !== "USDC" && ticker !== "stMATIC")
                        .map((ticker, index) => (
                            <option key={index} value={ticker}>
                                {ticker}
                            </option>
                        ))}
                </select>
            </div>

            <div className="text-base font-regular text-black">Current Token Price</div>
            <div className="text-base font-regular text-black">${tokenPrice}</div>

            <div className="text-base font-regular text-black">Max Position Size</div>
            <div className="text-base font-regular text-black">${maxPositionSize}</div>

            <div className="text-base font-regular text-black">Position Size (USDC)</div>
            <div>
                <div className="flex items-center">
                    <input
                        type="number"
                        value={requestAmount}
                        max={Number(maxPositionSize)}
                        onChange={(e) => {
                            let newValue = e.target.value
                            if (newValue === "" || (!isNaN(newValue) && newValue >= 0)) {
                                setRequestAmount(newValue)
                                setIsOverMaxPositionSize(false)
                            }
                            if (Number(newValue) > Number(maxPositionSize)) {
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
                            setRequestAmount(Number(maxPositionSize))
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
                        Maximum position size is {maxPositionSize}
                    </div>
                )}
            </div>

            <div className="text-base font-regular text-black ">New Health Factor</div>
            <div className="text-base font-regular text-black ">{newHealthFactor}</div>

            <div className="text-base font-regular text-black">New Min. Net Position</div>
            <div className="text-base font-regular text-black">${newMinNetPosition}</div>

            <div className="text-base font-regular text-black ">Interest</div>
            <div className="text-base font-regular text-black ">{interest}%</div>

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
