import { ethers } from "ethers"

// Artifacts
const ERC20ABI = require("../../artifacts/ERC20ABI.json")
const { abi: IQuoterABI } = require("../../artifacts/IQuoter.json")

const getProvider = () => {
    return new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_POLYGON_RPC_KEY)
}

const getPrice = async (
    provider,
    polygonTickerToAddress,
    deFiContractToAddress,
    tokenAddress,
    ticker
) => {
    try {
        const signer = provider.getSigner()
        // Addresses
        const usdcAddress = polygonTickerToAddress.USDC
        const quoterAddress = deFiContractToAddress.Quoter

        // Contracts
        const quoterContract = new ethers.Contract(quoterAddress, IQuoterABI, provider)
        const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider)

        // Setup Quote
        const poolFee = 3000
        const amount = 1
        const decimals = await tokenContract.decimals()
        const amountParsed = ethers.utils.parseUnits(amount.toString(), decimals)

        // Get Quote
        const quote = await quoterContract.callStatic.quoteExactInputSingle(
            tokenAddress,
            usdcAddress,
            poolFee,
            amountParsed,
            0
        )
        let quoteParsed = ethers.utils.formatUnits(quote.toString(), 6)
        quoteParsed = Math.floor(parseFloat(quoteParsed) * 100000) / 100000

        return { ticker, price: quoteParsed }
    } catch (error) {
        throw error
    }
}

export default async function handler(req, res) {
    const provider = getProvider()
    const { polygonTickerToAddress, deFiContractToAddress } = require("../../lib/polygonAddresses")

    try {
        const pricesPromises = Object.keys(polygonTickerToAddress)
            .filter((ticker) => ticker !== "USDC")
            .map((ticker) =>
                getPrice(
                    provider,
                    polygonTickerToAddress,
                    deFiContractToAddress,
                    polygonTickerToAddress[ticker],
                    ticker
                )
            )
        const pricesArray = await Promise.all(pricesPromises)
        const pricesObject = pricesArray.reduce(
            (obj, { ticker, price }) => ({ ...obj, [ticker]: price }),
            {}
        )

        res.status(200).json(pricesObject)
    } catch (error) {
        res.status(500).json({ error: error.toString() })
    }
}
