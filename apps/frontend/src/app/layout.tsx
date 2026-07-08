// apps/frontend/src/app/layout.tsx
import './globals.css'; 

export const metadata = {
  title: 'Support Operations Console',
  description: 'Human-in-the-loop AI Agent Supervision',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 min-h-screen antialiased font-sans">
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur sticky top-0 z-50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="font-mono font-bold tracking-tight text-sm uppercase">
                Support // Ops_Console
              </h1>
            </div>
            <nav className="flex gap-4 text-xs font-medium text-slate-400">
              <a href="/queue" className="hover:text-slate-100 transition">Queue</a>
              <a href="/orders" className="hover:text-slate-100 transition">Orders</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
