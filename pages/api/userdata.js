import { ethers } from "ethers"

// Artifacts
const ERC20ABI = require("../../artifacts/ERC20ABI.json")
const { abi: IPoolAddressesProviderABI } = require("../../artifacts/IPoolAddressesProvider.json")
const { abi: IPoolABI } = require("../../artifacts/IPool.json")

export default async function handler(req, res) {
    const { signerAddress, poolAddressesProviderAddress } = req.body

    try {
        // Connect to provider
        const provider = new ethers.providers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_POLYGON_RPC_KEY
        )
        const signer = provider.getSigner(signerAddress)

        // Contracts
        const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
        const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI)

        const poolAddressesProviderContract = new ethers.Contract(
            poolAddressesProviderAddress,
            IPoolAddressesProviderABI,
            signer
        )

        const poolContractAddress = await poolAddressesProviderContract.connect(provider).getPool()

        // Fetch and Format Data
        let { totalCollateralBase, totalDebtBase, currentLiquidationThreshold, healthFactor } =
            await new ethers.Contract(poolContractAddress, IPoolABI, signer)
                .connect(provider)
                .getUserAccountData(signerAddress)

        let usdBalance = await usdcContract.connect(provider).balanceOf(signerAddress)

        totalCollateralBase = ethers.utils.formatUnits(totalCollateralBase.toString(), 8)
        totalDebtBase = ethers.utils.formatUnits(totalDebtBase.toString(), 8)
        currentLiquidationThreshold = ethers.utils.formatUnits(
            currentLiquidationThreshold.toString(),
            2
        )

        currentLiquidationThreshold = Number(currentLiquidationThreshold) / 100
        healthFactor = ethers.utils.formatUnits(healthFactor.toString(), 18)

        usdBalance = Number(ethers.utils.formatUnits(usdBalance.toString(), 6))
        usdBalance = Math.floor(usdBalance * 1000) / 1000

        res.status(200).json({
            totalCollateralBase,
            totalDebtBase,
            currentLiquidationThreshold,
            healthFactor,
            usdBalance,
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}
