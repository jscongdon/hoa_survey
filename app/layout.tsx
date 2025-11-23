import type { Metadata } from 'next';
import './globals.css';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { AuthProvider } from '@/lib/auth/AuthContext';

export const metadata: Metadata = {
  title: 'HOA Survey',
  description: 'Secure survey management for HOA communities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
