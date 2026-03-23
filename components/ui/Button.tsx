import { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'destructive' | 'outline';
  href?: string;
  children: ReactNode;
}

export function Button({ variant = 'primary', href, className = '', children, ...props }: ButtonProps) {
  const baseStyles = "cursor-pointer inline-flex justify-center items-center rounded-full px-6 py-2 font-semibold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600",
    destructive: "bg-red-500 text-white hover:bg-red-400 focus-visible:outline-red-500",
    outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
  };

  const combinedClasses = `${baseStyles} ${variants[variant]} ${className}`;

  if (href) {
    return <Link href={href} className={combinedClasses}>{children}</Link>;
  }

  return <button className={combinedClasses} {...props}>{children}</button>;
}