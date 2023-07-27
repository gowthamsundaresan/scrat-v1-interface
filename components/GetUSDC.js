import React, { useState, useContext } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { ThirdwebSDK } from "@thirdweb-dev/sdk"
import { polygonTickerToAddress, deFiContractToAddress } from "../lib/polygonAddresses"
const { ethers } = require("ethers")

// Artifacts
const ERC20ABI = require("../artifacts/ERC20ABI.json")
const { abi: SwapRouter02ABI } = require("../artifacts/SwapRouter02.json")
const { abi: IUniswapV3PoolABI } = require("../artifacts/IUniswapV3Pool.json")

export const GetUSDC = () => {
    const signer = useContext(SignerContext)

    const [requestAmount, setRequestAmount] = useState("")

    const handleGetUSDCClick = async () => {
        // Init
        const sdk = ThirdwebSDK.fromSigner(signer)

        // Contracts
        const wmaticAddress = polygonTickerToAddress.WMATIC
        const usdcAddress = polygonTickerToAddress.USDC
        const swapRouterAddress = deFiContractToAddress.SwapRouter
        const poolAddress = deFiContractToAddress.WMATICUSDCPool

        const wmaticContract = await sdk.getContract(wmaticAddress, ERC20ABI, signer)
        const swapRouterContract = await sdk.getContract(swapRouterAddress, SwapRouter02ABI, signer)
        const poolContract = await sdk.getContract(poolAddress, IUniswapV3PoolABI, signer)
        const poolFee = await poolContract.call("fee")

        // Get WMATIC
        await sdk.wallet.transfer(wmaticAddress, requestAmount)
        const amountIn = ethers.utils.parseUnits(requestAmount.toString(), 18)

        // Swap WMATIC for USDC
        const approvalResponse = await wmaticContract.call("approve", [swapRouterAddress, amountIn])

        const params = {
            tokenIn: wmaticAddress,
            tokenOut: usdcAddress,
            fee: poolFee,
            recipient: signer._address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 10,
            amountIn: amountIn,
            amountOutMinimum: 1,
            sqrtPriceLimitX96: 0,
        }
        const tx = await swapRouterContract.call("exactInputSingle", [params]).then((tx) => {})
    }

    return (
        <div className="mt-8">
            <div className="flex flex-row gap-12">
                <div className="text-lg font-regular text-white py-2.5">Get USDC from MATIC</div>
                <div>
                    <input
                        type="number"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        placeholder="10 MATIC"
                        className="bg-black placeholder-white text-base placeholder-opacity-40 p-2.5 border-b-2 border-white"
                    ></input>
                </div>
                <div
                    onClick={handleGetUSDCClick}
                    className="text-black bg-white hover:text-white hover:bg-zinc-900 px-6 py-4 rounded-lg"
                >
                    Go
                </div>
            </div>
        </div>
    )
}
