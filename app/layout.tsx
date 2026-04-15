import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CoI Calculator',
  description: 'Production chain calculator for Captain of Industry',
}

type Props = {
  children: React.ReactNode
}

const RootLayout = ({ children }: Props) => (
  <html lang="en" className="dark" suppressHydrationWarning>
    <body className="min-h-screen bg-background text-foreground">{children}</body>
  </html>
)

export default RootLayout
