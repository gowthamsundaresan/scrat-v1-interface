import React, { useEffect, useState, useContext } from "react"
import { ethers } from "ethers"
import { SignerContext } from "../contexts/SignerContext"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"

// Artifacts
const { abi: IPoolAddressesProviderABI } = require("../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../artifacts/IPool.json")

export const useNetInterest = () => {
    const signer = useContext(SignerContext)
    const { polygonTickerToAddress, deFiContractToAddress } = useContext(PolygonAddressesContext)

    const [netInterestRates, setNetInterestRates] = useState({})
    const [interestLoading, setInterestLoading] = useState(true)

    useEffect(() => {
        const getNetInterestRate = async (tokenAddress, ticker) => {
            try {
                // Addresses
                const usdcAddress = polygonTickerToAddress["USDC"]
                const poolAddressesProviderAddress = deFiContractToAddress.PoolAddressesProvider

                // Contracts
                const poolAddressesProviderContract = new ethers.Contract(
                    poolAddressesProviderAddress,
                    IPoolAddressesProviderABI,
                    signer
                )
                const poolContractAddress = await poolAddressesProviderContract.getPool()
                const poolContract = new ethers.Contract(poolContractAddress, IPoolABI, signer)

                // Fetch and Format Data
                let {
                    currentLiquidityRate: currentLiquidityRateToken,
                    currentVariableBorrowRate: currentVariableBorrowToken,
                } = await poolContract.connect(signer.provider).getReserveData(tokenAddress)

                let {
                    currentLiquidityRate: currentLiquidityRateUSDC,
                    currentVariableBorrowRate: currentVariableBorrowUSDC,
                } = await poolContract.connect(signer.provider).getReserveData(usdcAddress)

                currentLiquidityRateToken = ethers.utils.formatUnits(currentLiquidityRateToken, 25)
                currentLiquidityRateToken = Number(currentLiquidityRateToken).toFixed(2).toString()

                currentVariableBorrowToken = ethers.utils.formatUnits(
                    currentVariableBorrowToken,
                    25
                )
                currentVariableBorrowToken = Number(currentVariableBorrowToken)
                    .toFixed(2)
                    .toString()

                currentLiquidityRateUSDC = ethers.utils.formatUnits(currentLiquidityRateUSDC, 25)
                currentLiquidityRateUSDC = Number(currentLiquidityRateUSDC).toFixed(2).toString()

                currentVariableBorrowUSDC = ethers.utils.formatUnits(currentVariableBorrowUSDC, 25)
                currentVariableBorrowUSDC = Number(currentVariableBorrowUSDC).toFixed(2).toString()

                let netInterestRateLong = currentLiquidityRateToken - currentVariableBorrowUSDC
                netInterestRateLong = Number(netInterestRateLong).toFixed(2).toString()

                let netInterestRateShort = currentLiquidityRateUSDC - currentVariableBorrowToken
                netInterestRateShort = Number(netInterestRateShort).toFixed(2).toString()

                return { ticker, netInterestRateLong, netInterestRateShort }
            } catch (error) {
                throw error
            }
        }

        const fetchRates = async () => {
            try {
                setInterestLoading(true)

                const allTokens = Object.keys(polygonTickerToAddress)
                const ratesArray = await Promise.all(
                    allTokens.map(async (ticker) => {
                        const address = polygonTickerToAddress[ticker]
                        return getNetInterestRate(address, ticker)
                    })
                )

                const ratesObject = ratesArray.reduce((acc, currentRate) => {
                    acc[currentRate.ticker] = {
                        netInterestRateLong: currentRate.netInterestRateLong,
                        netInterestRateShort: currentRate.netInterestRateShort,
                    }
                    return acc
                }, {})

                setNetInterestRates(ratesObject)
                setInterestLoading(false)
            } catch (error) {
                console.error(error)
                setInterestLoading(false)
            }
        }

        fetchRates()
        const intervalId = setInterval(fetchRates, 300000) // Fetch rates every 5 minutes

        return () => {
            clearInterval(intervalId)
        }
    }, [signer, polygonTickerToAddress])

    return { netInterestRates, interestLoading }
}
