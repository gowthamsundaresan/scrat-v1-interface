import React, { useEffect, useState, useContext } from "react"
import { supabase } from "../lib/supabaseClient"
import { SignerContext } from "../contexts/SignerContext"
import { polygonTickerToAddress } from "../lib/polygonAddresses"

export const TransactionHistory = () => {
    const signer = useContext(SignerContext)

    const [transactionHistory, setTransactionHistory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (signer) {
            setLoading(false)
        }
    }, [signer])

    useEffect(() => {
        if (signer) {
            setLoading(false)
            fetchData(signer)
        }
    }, [signer])

    const fetchData = async (signer) => {
        // Fetch Open Actions from DB
        let { data: openData, error: error1 } = await supabase
            .from("Open Actions")
            .select("id,asset,direction,open_size,open_price,created_at")
            .eq("address", signer._address)

        if (error1) {
            console.error(error1)
        }

        let openActionsById = {}
        let openTransactions = {}

        if (openData) {
            openActionsById = openData.reduce((acc, item) => {
                acc[item.id] = item
                return acc
            }, {})

            openTransactions = openData.reduce((acc, item) => {
                let createdAtDate = new Date(item.created_at)
                let formattedDate = createdAtDate.toLocaleString()

                acc[formattedDate] =
                    "Opened " +
                    findKeyByValue(item.asset) +
                    " " +
                    findDirection(item.direction) +
                    " position of $" +
                    (item.open_size * item.open_price).toFixed(2).toString() +
                    " (" +
                    item.open_size.toFixed(2).toString() +
                    " " +
                    findKeyByValue(item.asset) +
                    ") " +
                    "@ $" +
                    item.open_price.toFixed(3).toString() +
                    " at " +
                    formattedDate

                return acc
            }, {})
        }

        // Fetch Close Actions from DB
        let closeTransactions = {}
        if (openData) {
            const ids = openData.map((item) => item.id)
            let { data: closeData, error: error2 } = await supabase
                .from("Close Actions")
                .select("position_id,close_size,close_price,p_and_l,created_at")
                .in("position_id", ids)

            if (error2) {
                console.error(error2)
            }

            if (closeData) {
                closeTransactions = closeData.reduce((acc, item) => {
                    let createdAtDate = new Date(item.created_at)
                    let formattedDate = createdAtDate.toLocaleString()

                    let openAction = openActionsById[item.position_id]

                    acc[formattedDate] =
                        "Closed " +
                        findKeyByValue(openAction.asset) +
                        " " +
                        findDirection(openAction.direction) +
                        " position of $" +
                        (item.close_size * item.close_price).toFixed(2).toString() +
                        " (" +
                        item.close_size.toFixed(2).toString() +
                        " " +
                        findKeyByValue(openAction.asset) +
                        ") " +
                        "@ $" +
                        item.close_price.toFixed(3).toString() +
                        " with P/L of $" +
                        item.p_and_l.toFixed(2).toString() +
                        " at " +
                        formattedDate

                    return acc
                }, {})
            }
        }

        // Fetch Deposit Actions from DB
        let { data: depositData, error: error3 } = await supabase
            .from("Deposit Actions")
            .select("deposit_amount,created_at")
            .eq("address", signer._address)

        if (error3) {
            console.error(error3)
        }

        let depositTransactions = {}

        if (depositData) {
            depositTransactions = depositData.reduce((acc, item) => {
                let createdAtDate = new Date(item.created_at)
                let formattedDate = createdAtDate.toLocaleString()

                acc[formattedDate] =
                    "Deposited " +
                    Number(item.deposit_amount).toFixed(2).toString() +
                    " USDC at " +
                    formattedDate

                return acc
            }, {})
        }

        // Fetch Withdraw Actions from DB
        let { data: withdrawData, error: error4 } = await supabase
            .from("Withdraw Actions")
            .select("withdraw_amount,created_at")
            .eq("address", signer._address)

        if (error4) {
            console.error(error4)
        }

        let withdrawTransactions = {}

        if (withdrawData) {
            withdrawTransactions = withdrawData.reduce((acc, item) => {
                let createdAtDate = new Date(item.created_at)
                let formattedDate = createdAtDate.toLocaleString()

                acc[formattedDate] =
                    "Withdrew " +
                    item.withdraw_amount.toFixed(2).toString() +
                    " USDC at " +
                    formattedDate

                return acc
            }, {})
        }
        // Sort and Create Final Array of Transactions
        let combinedTransactions = {
            ...openTransactions,
            ...closeTransactions,
            ...depositTransactions,
            ...withdrawTransactions,
        }
        let transactionsArray = Object.entries(combinedTransactions)
        transactionsArray.sort((a, b) => new Date(b[0]) - new Date(a[0]))
        let sortedTransactions = transactionsArray.map(([date, transaction]) => transaction)

        setTransactionHistory(sortedTransactions)
    }

    const findKeyByValue = (value) => {
        return Object.keys(polygonTickerToAddress).find(
            (key) => polygonTickerToAddress[key].toLowerCase() === value.toLowerCase()
        )
    }

    const findDirection = (direction) => {
        return direction == 0 ? "long" : "short"
    }

    return (
        <div className="border-2 border-black bg-scrat-gray rounded-lg px-8 py-8">
            <div className="text-2xl font-bold text-white">Transaction History</div>
            {transactionHistory.length == 0 ? (
                <div className="mt-8">
                    <div className="col-span-6 flex text-lg justify-center mt-16 mb-8 text-zinc-400">
                        No transactions yet.
                    </div>
                </div>
            ) : (
                <div className="mt-8">
                    {transactionHistory.map((transaction, index) => (
                        <div
                            className={`p-4 text-base ${index % 2 === 0 ? "bg-neutral-800" : ""}`}
                            key={index}
                        >
                            {transaction}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
