import React, { useState, useContext, useEffect } from "react"
import { SignerContext } from "../contexts/SignerContext"
import { supabase } from "../lib/supabaseClient"
import { OpenLongPosition } from "./OpenLongPosition"
import { OpenShortPosition } from "./OpenShortPosition"
import { CloseLongPosition } from "./CloseLongPosition"
import { CloseShortPosition } from "./CloseShortPosition"
import { polygonTickerToAddress } from "../lib/polygonAddresses"

export const PositionsDashboard = () => {
    const signer = useContext(SignerContext)

    const [tokenPrices, setTokenPrices] = useState([])
    const [netInterestRates, setNetInterestRates] = useState([])
    const [longPositions, setLongPositions] = useState([])
    const [shortPositions, setShortPositions] = useState([])
    const [isOpenLongPositionModalOpen, setIsOpenLongPositionModalOpen] = useState(false)
    const [isOpenShortPositionModalOpen, setIsOpenShortPositionModalOpen] = useState(false)
    const [isCloseLongPositionModalOpen, setIsCloseLongPositionModalOpen] = useState(false)
    const [isCloseShortPositionModalOpen, setIsCloseShortPositionModalOpen] = useState(false)
    const [selectedLongPositionId, setSelectedLongPositionId] = useState(null)
    const [selectedLongPositionTicker, setSelectedLongPositionTicker] = useState(null)
    const [selectedLongPositionCurrent, setSelectedLongPositionCurrent] = useState(null)
    const [selectedShortPositionId, setSelectedShortPositionId] = useState(null)
    const [selectedShortPositionTicker, setSelectedShortPositionTicker] = useState(null)
    const [selectedShortPositionCurrent, setSelectedShortPositionCurrent] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPrices = async () => {
            const res = await fetch("/api/prices")
            const prices = await res.json()
            setTokenPrices(prices)
        }

        fetchPrices()

        const intervalId = setInterval(fetchPrices, 60000)

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
        if (
            signer &&
            Object.keys(tokenPrices).length > 0 &&
            Object.keys(netInterestRates).length > 0
        ) {
            setLoading(false)
            fetchData(signer)
        }
    }, [signer, tokenPrices, netInterestRates])

    const fetchData = async (signer) => {
        // Fetch Long Positions from DB
        let { data: longPositionsData, error: error1 } = await supabase
            .from("Open Actions")
            .select("id,asset,open_price,current_size")
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
                    if (
                        polygonTickerToAddress[key].toLowerCase() === position.asset.toLowerCase()
                    ) {
                        ticker = key
                        break
                    }
                }

                let id = position.id
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

                let interest = netInterestRates[ticker].netInterestRateLong

                return {
                    id,
                    ticker,
                    open,
                    current,
                    pAndL,
                    openPrice,
                    currentSizeBase,
                    tokenPrice,
                    interest,
                }
            })
        }
        setLongPositions(processedLongPositions)

        // Fetch Short Positions from DB
        let { data: shortPositionsData, error: error2 } = await supabase
            .from("Open Actions")
            .select("id,asset,open_price,current_size")
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

                let id = position.id
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

                let interest = netInterestRates[ticker].netInterestRateShort

                return {
                    id,
                    ticker,
                    open,
                    current,
                    pAndL,
                    openPrice,
                    currentSizeBase,
                    tokenPrice,
                    interest,
                }
            })
        }
        setShortPositions(processedShortPositions)
    }
    const handleLongCloseClick = (id, ticker, current) => {
        setSelectedLongPositionId(id)
        setSelectedLongPositionTicker(ticker)
        setSelectedLongPositionCurrent(current)
        setIsCloseLongPositionModalOpen(true)
    }

    const handleShortCloseClick = (id, ticker, current) => {
        setSelectedShortPositionId(id)
        setSelectedShortPositionTicker(ticker)
        setSelectedShortPositionCurrent(current)
        setIsCloseShortPositionModalOpen(true)
    }

    return (
        <div>
            <div className="border-2 border-black bg-scrat-gray rounded-lg px-8 py-8">
                <div className="flex flex-row">
                    <div className="flex flex-row justify-between items-center w-full">
                        <div className="text-2xl font-bold text-white">Long Positions</div>
                        <div
                            onClick={() => setIsOpenLongPositionModalOpen(true)}
                            className="text-sm text-black bg-white hover:text-white hover:bg-zinc-700 px-6 py-4 rounded-lg"
                        >
                            Open Long
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4 mt-2">
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Asset</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Open</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Current Position</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">P/L</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Interest</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Actions</div>
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4">
                    {longPositions.length == 0 ? (
                        <div className="col-span-6 flex text-lg justify-center mt-16 mb-8 text-zinc-400">
                            No open long positions.
                        </div>
                    ) : (
                        longPositions.map((position, index) => (
                            <React.Fragment key={index}>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        {position.ticker}
                                    </div>
                                </div>
                                <div className="col-span-1 flex flex-col justify-start items-center">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.open}
                                    </div>
                                    <div className="text-xs text-center text-white mt-2">
                                        ({position.currentSizeBase} {position.ticker} @ $
                                        {position.openPrice})
                                    </div>
                                </div>
                                <div className="col-span-1 flex flex-col justify-start items-center">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.current}
                                    </div>
                                    <div className="text-xs text-center text-white mt-2">
                                        ({position.currentSizeBase} {position.ticker} @ $
                                        {position.tokenPrice})
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.pAndL}
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        {position.interest}%
                                    </div>
                                </div>
                                <div
                                    onClick={() =>
                                        handleLongCloseClick(
                                            position.id,
                                            position.ticker,
                                            position.current,
                                            position.pAndL
                                        )
                                    }
                                    className="col-span-1 flex justify-center items-start"
                                >
                                    <button className="text-sm font-bold text-white mt-12">
                                        Close x
                                    </button>
                                </div>
                            </React.Fragment>
                        ))
                    )}
                </div>
            </div>
            <div className="border-2 border-black bg-scrat-gray rounded-lg px-8 py-8 mt-4">
                <div className="flex flex-row">
                    <div className="flex flex-row justify-between items-center w-full">
                        <div className="text-2xl font-bold text-white">Short Positions</div>
                        <div
                            onClick={() => setIsOpenShortPositionModalOpen(true)}
                            className="text-sm text-black bg-white hover:text-white hover:bg-zinc-700 px-6 py-4 rounded-lg"
                        >
                            Open Short
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4 mt-2">
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Asset</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Open</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Current Position</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">P/L</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Interest</div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">
                        <div className="text-sm font-bold text-zinc-400 mt-4">Actions</div>
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4">
                    {shortPositions.length == 0 ? (
                        <div className="col-span-6 flex text-lg justify-center mt-16 mb-8 text-zinc-400">
                            No open short positions.
                        </div>
                    ) : (
                        shortPositions.map((position, index) => (
                            <React.Fragment key={index}>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        {position.ticker}
                                    </div>
                                </div>
                                <div className="col-span-1 flex flex-col justify-start items-center">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.open}
                                    </div>
                                    <div className="text-xs text-center text-white mt-2">
                                        ({position.currentSizeBase} {position.ticker} @ $
                                        {position.openPrice})
                                    </div>
                                </div>
                                <div className="col-span-1 flex flex-col justify-start items-center">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.current}
                                    </div>
                                    <div className="text-xs text-center text-white mt-2">
                                        ({position.currentSizeBase} {position.ticker} @ $
                                        {position.tokenPrice})
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        ${position.pAndL}
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-center items-start">
                                    <div className="text-base font-bold text-white mt-12">
                                        {position.interest}%
                                    </div>
                                </div>
                                <div
                                    onClick={() =>
                                        handleShortCloseClick(
                                            position.id,
                                            position.ticker,
                                            position.current,
                                            position.pAndL
                                        )
                                    }
                                    className="col-span-1 flex justify-center items-start"
                                >
                                    <button className="text-sm font-bold text-white mt-12">
                                        Close x
                                    </button>
                                </div>
                            </React.Fragment>
                        ))
                    )}
                </div>
            </div>
            {isOpenLongPositionModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setIsOpenLongPositionModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <OpenLongPosition
                            closeOpenLongModal={() => setIsOpenLongPositionModalOpen(false)}
                        />
                    </div>
                </div>
            )}
            {isOpenShortPositionModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setIsOpenShortPositionModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <OpenShortPosition
                            closeOpenShortModal={() => setIsOpenShortPositionModalOpen(false)}
                        />
                    </div>
                </div>
            )}
            {isCloseLongPositionModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setIsCloseLongPositionModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <CloseLongPosition
                            closeCloseLongModal={() => setIsCloseLongPositionModalOpen(false)}
                            id={selectedLongPositionId}
                            ticker={selectedLongPositionTicker}
                            current={selectedLongPositionCurrent}
                        />
                    </div>
                </div>
            )}
            {isCloseShortPositionModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="relative bg-slate-200 rounded-lg p-6 m-4">
                        <button
                            onClick={() => setIsCloseShortPositionModalOpen(false)}
                            className="absolute top-0 right-0 m-4 text-black font-bold"
                        >
                            x
                        </button>
                        <CloseShortPosition
                            closeCloseShortModal={() => setIsCloseShortPositionModalOpen(false)}
                            id={selectedShortPositionId}
                            ticker={selectedShortPositionTicker}
                            current={selectedShortPositionCurrent}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
