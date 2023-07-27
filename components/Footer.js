import React from "react"
import Link from "next/link"

export default function Footer() {
    return (
        <div className="flex flex-wrap justify-between items-center p-4 md:p-8 bg-scrat-gray text-white">
            <div className="w-full md:w-auto text-center md:text-left mb-4 md:mb-0">
                <Link href="https://scrat.finance">
                    <img
                        src="/scrat-finance-logo.svg"
                        alt="Scrat Finance Logo"
                        className="w-40 md:w-48 mx-auto md:mx-0"
                    />
                </Link>
            </div>
            <div className="flex gap-2 md:gap-4 justify-center md:justify-end w-full md:w-auto">
                <a href="https://twitter.com/scratfinance" target="_blank" rel="noreferrer">
                    <img
                        src="/twitter-icon.png"
                        alt="Twitter Icon"
                        width="24"
                        height="24"
                        className="md:w-8 md:h-8"
                    />
                </a>
                <a
                    href="https://github.com/gowthamsundaresan/scrat-v1"
                    target="_blank"
                    rel="noreferrer"
                >
                    <img
                        src="/github-icon.png"
                        alt="Github Icon"
                        width="24"
                        height="24"
                        className="md:w-8 md:h-8"
                    />
                </a>
                <a href="" target="_blank" rel="noreferrer">
                    <img
                        src="/telegram-icon.png"
                        alt="Telegram Icon"
                        width="24"
                        height="24"
                        className="md:w-8 md:h-8"
                    />
                </a>
                <a href="mailto:gowtham@scrat.finance" target="_blank" rel="noreferrer">
                    <img
                        src="/email-icon.png"
                        alt="Email Icon"
                        width="24"
                        height="24"
                        className="md:w-8 md:h-8"
                    />
                </a>
            </div>
        </div>
    )
}
