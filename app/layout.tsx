'use client';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>SecureX Pro</title>
        <meta
          name="description"
          content="Unified Vulnerability Assessment & Exploitation Analysis Framework"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <div className="grid-bg" />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}