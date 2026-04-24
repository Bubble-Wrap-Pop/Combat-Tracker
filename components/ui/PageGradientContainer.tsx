import { ReactNode } from 'react';

export function PageContainer({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div className={`min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-200 p-4 font-sans dark:from-zinc-800 dark:to-zinc-900 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}