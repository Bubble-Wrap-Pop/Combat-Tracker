import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div className={`bg-white dark:bg-zinc-800/50 p-4 sm:p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}