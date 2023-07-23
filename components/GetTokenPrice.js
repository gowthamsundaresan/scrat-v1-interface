import React, { useEffect, useState, useContext } from "react"
import { ethers } from "ethers"
import { SignerContext } from "../contexts/SignerContext"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: IQuoterABI } = require("../artifacts/IQuoter.json")

export const useTokenPrice = () => {
    const signer = useContext(SignerContext)
    const { polygonTickerToAddress, deFiContractToAddress } = useContext(PolygonAddressesContext)

    const [tokenPrices, setTokenPrices] = useState({})
    const [fetchError, setFetchError] = useState(null)
    const [pricesLoading, setPricesLoading] = useState(true)

    useEffect(() => {
        const getPrice = async (tokenAddress, ticker) => {
            try {
                // Addresses
                const usdcAddress = polygonTickerToAddress.USDC
                const quoterAddress = deFiContractToAddress.Quoter

                // Contracts
                const quoterContract = new ethers.Contract(
                    quoterAddress,
                    IQuoterABI,
                    signer.provider
                )
                const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer.provider)

                // Setup Quote
                const poolFee = 3000
                const amount = 1
                const decimals = await tokenContract.decimals()
                const amountParsed = ethers.utils.parseUnits(amount.toString(), decimals)

                // Get Quote
                const quote = await quoterContract
                    .connect(signer.provider)
                    .callStatic.quoteExactInputSingle(
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

        let intervalId

        const fetchPrices = async () => {
            try {
                setPricesLoading(true)
                const pricesPromises = Object.keys(polygonTickerToAddress)
                    .filter((ticker) => ticker !== "USDC")
                    .map((ticker) => getPrice(polygonTickerToAddress[ticker], ticker))
                const pricesArray = await Promise.all(pricesPromises)
                const pricesObject = pricesArray.reduce(
                    (obj, { ticker, price }) => ({ ...obj, [ticker]: price }),
                    {}
                )
                setTokenPrices(pricesObject)
                setPricesLoading(false)
            } catch (error) {
                setFetchError(error)
                setPricesLoading(false)
            }
        }

        fetchPrices()
        intervalId = setInterval(fetchPrices, 10000) // Fetch prices every 10 seconds

        return () => {
            clearInterval(intervalId)
        }
    }, [signer])

    return { tokenPrices, fetchError, pricesLoading }
}
