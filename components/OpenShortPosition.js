import React, { useState, useContext, useEffect } from "react"
const { ethers } = require("ethers")
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { supabase } from "../lib/supabaseClient"
import { useTokenPrice } from "./GetTokenPrice"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"
import { useNetInterest } from "./GetNetInterest"

// Artifacts
const { abi: VariableDebtTokenABI } = require("../artifacts/VariableDebtToken.json")
const { abi: CrossMarginTradingABI } = require("../artifacts/CrossMarginTrading.json")
const { abi: IPoolAddressesProviderABI } = require("../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../artifacts/IPool.json")

export const OpenShortPosition = ({ closeOpenShortModal }) => {
    const direction = 1
    const signer = useContext(SignerContext)

    const { tokenPrices, pricesLoading } = useTokenPrice()
    const {
        polygonTickerToAddress,
        polygonTickerToVAddress,
        deFiContractToAddress,
        liquidationThresholds,
        loanToValues,
    } = useContext(PolygonAddressesContext)
    const { netInterestRates, interestLoading } = useNetInterest()

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
        if (
            signer &&
            !pricesLoading &&
            !polygonTickerToAddress &&
            !polygonTickerToVAddress &&
            !interestLoading &&
            !deFiContractToAddress &&
            !loanToValues
        ) {
            setLoading(false)
        }
    }, [
        signer,
        pricesLoading,
        polygonTickerToAddress,
        polygonTickerToVAddress,
        interestLoading,
        deFiContractToAddress,
        selectedAsset,
        loanToValues,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(netInterestRates).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(polygonTickerToVAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
            calculateConstantData(signer)
        }
    }, [
        signer,
        tokenPrices,
        polygonTickerToAddress,
        polygonTickerToVAddress,
        netInterestRates,
        deFiContractToAddress,
        loanToValues,
    ])

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(netInterestRates).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0 &&
            Object.keys(polygonTickerToVAddress).length !== 0 &&
            Object.keys(deFiContractToAddress).length !== 0
        ) {
            setLoading(false)
            calculateNewData(signer)
        }
    }, [
        signer,
        requestAmount,
        polygonTickerToAddress,
        polygonTickerToVAddress,
        selectedAsset,
        netInterestRates,
        deFiContractToAddress,
        loanToValues,
    ])

    const handleSelectChange = (e) => {
        setSelectedAsset(e.target.value)
    }

    const calculateConstantData = async (signer) => {
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

        // Token Price
        setTokenPrice(Number(tokenPrices[selectedAsset]).toFixed(3).toString())

        // New HF
        let newLT =
            Number(currentLiquidationThreshold) *
                (Number(totalCollateralBase) /
                    (Number(totalCollateralBase) + Number(requestAmount))) +
            liquidationThresholds["USDC"] *
                (Number(requestAmount) / (Number(totalCollateralBase) + Number(requestAmount)))

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
