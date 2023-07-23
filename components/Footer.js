import React from "react"
import Link from "next/link"

export default function Footer() {
    return (
        <div className="flex justify-between items-center p-8 bg-scrat-gray text-white">
            <div>
                <Link href="/">
                    <img src="/scrat-finance-logo.svg" alt="Scrat Finance Logo" className="w-48" />
                </Link>
            </div>
            <div className="flex gap-4">
                <a href="" target="_blank" rel="noreferrer">
                    <img src="/twitter-icon.png" alt="Twitter Icon" width="32" height="32" />
                </a>
                <a href="" target="_blank" rel="noreferrer">
                    <img src="/github-icon.png" alt="Github Icon" width="32" height="32" />
                </a>
                <a href="" target="_blank" rel="noreferrer">
                    <img src="/telegram-icon.png" alt="Telegram Icon" width="32" height="32" />
                </a>
                <a href="" target="_blank" rel="noreferrer">
                    <img src="/email-icon.png" alt="Email Icon" width="32" height="32" />
                </a>
            </div>
        </div>
    )
}
