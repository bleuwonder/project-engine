import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Factory',
  description: 'AI Build Factory — workflow dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f172a', color: '#f1f5f9', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
