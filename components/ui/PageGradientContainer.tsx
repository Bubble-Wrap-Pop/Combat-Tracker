import { ReactNode } from 'react';

export function PageContainer({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div className={`min-h-screen p-4 sm:p-8 bg-gradient-to-b from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-black font-sans ${className}`}>
      {children}
    </div>
  );
}