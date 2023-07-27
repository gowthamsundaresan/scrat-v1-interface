import { ethers } from "ethers"

// Artifacts
const { abi: IPoolAddressesProviderABI } = require("../../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../../artifacts/IPool.json")

const getProvider = () => {
    return new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_POLYGON_RPC_KEY)
}

const getNetInterestRate = async (
    provider,
    polygonTickerToAddress,
    deFiContractToAddress,
    tokenAddress,
    ticker
) => {
    try {
        // Addresses
        const usdcAddress = polygonTickerToAddress["USDC"]
        const poolAddressesProviderAddress = deFiContractToAddress.PoolAddressesProvider

        // Contracts
        const poolAddressesProviderContract = new ethers.Contract(
            poolAddressesProviderAddress,
            IPoolAddressesProviderABI,
            provider
        )
        const poolContractAddress = await poolAddressesProviderContract.getPool()
        const poolContract = new ethers.Contract(poolContractAddress, IPoolABI, provider)

        // Fetch and Format Data
        let {
            currentLiquidityRate: currentLiquidityRateToken,
            currentVariableBorrowRate: currentVariableBorrowToken,
        } = await poolContract.getReserveData(tokenAddress)

        let {
            currentLiquidityRate: currentLiquidityRateUSDC,
            currentVariableBorrowRate: currentVariableBorrowUSDC,
        } = await poolContract.getReserveData(usdcAddress)

        currentLiquidityRateToken = ethers.utils.formatUnits(currentLiquidityRateToken, 25)
        currentLiquidityRateToken = Number(currentLiquidityRateToken).toFixed(2).toString()

        currentVariableBorrowToken = ethers.utils.formatUnits(currentVariableBorrowToken, 25)
        currentVariableBorrowToken = Number(currentVariableBorrowToken).toFixed(2).toString()

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

export default async function handler(req, res) {
    const provider = getProvider()
    const { polygonTickerToAddress, deFiContractToAddress } = require("../../lib/polygonAddresses")

    try {
        const allTokens = Object.keys(polygonTickerToAddress)
        const ratesArray = await Promise.all(
            allTokens.map(async (ticker) => {
                const address = polygonTickerToAddress[ticker]
                return getNetInterestRate(
                    provider,
                    polygonTickerToAddress,
                    deFiContractToAddress,
                    address,
                    ticker
                )
            })
        )

        const ratesObject = ratesArray.reduce((acc, currentRate) => {
            acc[currentRate.ticker] = {
                netInterestRateLong: currentRate.netInterestRateLong,
                netInterestRateShort: currentRate.netInterestRateShort,
            }
            return acc
        }, {})

        res.status(200).json(ratesObject)
    } catch (error) {
        res.status(500).json({ error: error.toString() })
    }
}
