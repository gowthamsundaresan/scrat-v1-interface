import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { useTokenPrice } from "./GetTokenPrice"
import { supabase } from "../lib/supabaseClient"
import { PolygonAddressesContext } from "../contexts/PolygonAddressesContext"

export const TradingPerformanceDashboard = () => {
    const signer = useContext(SignerContext)
    const { polygonTickerToAddress } = useContext(PolygonAddressesContext)
    const { tokenPrices, pricesLoading } = useTokenPrice()

    const [inAccount, setInAccount] = useState([" Loading"])
    const [unrealizedPandL, setUnrealizedPandL] = useState([" Loading"])
    const [realizedPandL, setRealizedPandL] = useState([" Loading"])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(polygonTickerToAddress).length !== 0
        ) {
            setLoading(false)
            fetchDepositsData(signer)
            fetchRealizedPandLData(signer)
            fetchUnrealizedPandLData(signer)
        }
    }, [signer, tokenPrices, pricesLoading])

    const fetchDepositsData = async (signer) => {
        // Fetch Margin Account from DB
        let { data: accountDetails, error: error1 } = await supabase
            .from("Margin Accounts")
            .select("amount")
            .eq("address", signer._address)

        setInAccount(
            accountDetails && accountDetails[0] ? Number(accountDetails[0].amount).toFixed(2) : 0
        )

        return {}
    }

    const fetchRealizedPandLData = async (signer) => {
        // Fetch desired records from 'Open Actions'
        let { data: openActionsData, error: error1 } = await supabase
            .from("Open Actions")
            .select("id")
            .eq("address", signer._address)

        if (openActionsData) {
            // Extract ids
            let positionIds = openActionsData.map((item) => item.id)

            // Fetch records from 'Close Actions'
            let { data: closeActionsData, error: error2 } = await supabase
                .from("Close Actions")
                .select("p_and_l")
                .in("position_id", positionIds)

            setRealizedPandL(
                closeActionsData
                    .reduce((total, item) => {
                        return total + parseFloat(item.p_and_l)
                    }, 0)
                    .toFixed(2)
            )
        } else {
            setRealizedPandL(Number(0))
        }

        return {}
    }

    const fetchUnrealizedPandLData = async (signer) => {
        // Fetch Long Positions from DB
        let unrealizedPandL = 0
        let { data: longPositionsData, error: error1 } = await supabase
            .from("Open Actions")
            .select("asset,open_price,current_size")
            .eq("address", signer._address)
            .eq("direction", 0)
            .eq("is_active", true)

        let processedLongPositions = []

        if (longPositionsData) {
            processedLongPositions = longPositionsData.map((position) => {
                let ticker = Object.keys(polygonTickerToAddress).find(
                    (key) =>
                        polygonTickerToAddress[key].toLowerCase() === position.asset.toLowerCase()
                )
                for (let key in polygonTickerToAddress) {
                    if (key.toLowerCase() === position.asset.toLowerCase()) {
                        ticker = polygonTickerToAddress[key]
                        break
                    }
                }

                let openPrice = Number(position.open_price)
                openPrice = Math.floor(openPrice * 1000) / 1000
                let currentSizeBase = Number(position.current_size)
                currentSizeBase =
                    ticker == "WBTC"
                        ? Math.floor(currentSizeBase * 1000000) / 1000000
                        : Math.floor(currentSizeBase * 10000) / 10000
                let tokenPrice = Number(tokenPrices[ticker])
                tokenPrice = Math.floor(tokenPrice * 1000) / 1000

                let open = currentSizeBase * openPrice
                open = Math.floor(open * 1000) / 1000
                let current = currentSizeBase * tokenPrice
                current = Math.floor(current * 1000) / 1000
                let pAndL = current - open
                pAndL = Math.floor(pAndL * 1000) / 1000

                unrealizedPandL = unrealizedPandL + Number(pAndL)
            })
        }

        // Fetch Short Positions from DB
        let { data: shortPositionsData, error: error2 } = await supabase
            .from("Open Actions")
            .select("asset,open_price,current_size")
            .eq("address", signer._address)
            .eq("direction", 1)
            .eq("is_active", true)

        let processedShortPositions = []
        if (shortPositionsData) {
            processedShortPositions = shortPositionsData.map((position) => {
                let ticker = Object.keys(polygonTickerToAddress).find(
                    (key) =>
                        polygonTickerToAddress[key].toLowerCase() === position.asset.toLowerCase()
                )
                for (let key in polygonTickerToAddress) {
                    if (
                        polygonTickerToAddress[key].toLowerCase() === position.asset.toLowerCase()
                    ) {
                        ticker = key
                        break
                    }
                }

                let openPrice = Number(position.open_price)
                openPrice = Math.floor(openPrice * 1000) / 1000
                let currentSizeBase = Number(position.current_size)
                currentSizeBase =
                    ticker == "WBTC"
                        ? Math.floor(currentSizeBase * 1000000) / 1000000
                        : Math.floor(currentSizeBase * 10000) / 10000
                let tokenPrice = Number(tokenPrices[ticker])
                tokenPrice = Math.floor(tokenPrice * 1000) / 1000

                let open = currentSizeBase * openPrice
                open = Math.floor(open * 1000) / 1000
                let current = currentSizeBase * tokenPrice
                current = Math.floor(current * 1000) / 1000
                let pAndL = open - current
                pAndL = Math.floor(pAndL * 1000) / 1000

                unrealizedPandL = unrealizedPandL + Number(pAndL)
            })
        }
        unrealizedPandL = Math.floor(unrealizedPandL * 1000) / 1000
        setUnrealizedPandL(unrealizedPandL)
        return {}
    }

    return (
        <div className="border-2 border-black bg-scrat-gray rounded-lg px-8 py-8">
            <div className="text-2xl font-bold text-white">Trading Performance</div>
            <div className="grid grid-cols-6 mt-4">
                <div>
                    <div className="text-sm font-regular text-white mt-4">Total Deposits</div>
                    <div className="text-lg font-bold text-white mt-2">${inAccount}</div>
                </div>
                <div>
                    <div className="text-sm font-regular text-white mt-4">Realized P/L</div>
                    <div className="text-lg font-bold text-white mt-2">${realizedPandL}</div>
                </div>
                <div>
                    <div className="text-sm font-regular text-white mt-4">Unrealized P/L</div>
                    <div className="text-lg font-bold text-white mt-2">${unrealizedPandL}</div>
                </div>
            </div>
        </div>
    )
}
