import { ThirdwebProvider } from "@thirdweb-dev/react"
import { Analytics } from "@vercel/analytics/react"
import "@/styles/globals.css"
import { Red_Hat_Text } from "next/font/google"

const redHatText = Red_Hat_Text({ subsets: ["latin"] })

// This is the chain your dApp will work on.
// Change this to the chain your app is built for.
// You can also import additional chains from `@thirdweb-dev/chains` and pass them directly.
const activeChain = "polygon"

export default function App({ Component, pageProps }) {
    return (
        <main className={redHatText.className}>
            <ThirdwebProvider activeChain={activeChain}>
                <Component {...pageProps} />
                <Analytics />
            </ThirdwebProvider>
        </main>
    )
}
