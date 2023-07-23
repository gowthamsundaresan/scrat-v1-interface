import React from "react"
import Link from "next/link"
import { ConnectWallet } from "@thirdweb-dev/react"

const Navbar = () => {
    return (
        <nav className="flex items-center justify-between px-5 bg-scrat-gray">
            <div className="flex items-center space-x-8">
                <Link href="/">
                    <img
                        src="../scrat-finance-logo.svg"
                        alt="Scrat Finance Logo"
                        className="w-48 h-24 mr-16 ml-8"
                    />
                </Link>

                <Link href="/dashboard">
                    <span className="cursor-pointer text-gray-300 hover:text-white mr-8">
                        Dashboard
                    </span>
                </Link>

                <Link href="/help">
                    <span className="cursor-pointer text-gray-300 hover:text-white mr-8">Help</span>
                </Link>
            </div>
            <div>
                <ConnectWallet />
            </div>
        </nav>
    )
}

export default Navbar
