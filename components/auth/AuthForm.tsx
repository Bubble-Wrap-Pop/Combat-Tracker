import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/PageGradientContainer'

export function AuthForm({
  title,
  error,
  message,
  children,
  submitLabel,
  footer,
  action,
}: {
  title: string
  error?: string
  message?: string
  children?: ReactNode
  submitLabel: string
  footer: ReactNode
  action: (formData: FormData) => void | Promise<void>
}) {
  return (
    <PageContainer className="flex flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-10 md:px-12">
      <div className="w-full max-w-md">
        <form action={action}>
          <Card className="p-6 sm:p-8">
            <h1 className="mb-4 text-center text-2xl font-semibold text-zinc-900 dark:text-white">
              {title}
            </h1>

            <div className="flex flex-col gap-4">
            {error && (
              <div className="rounded border border-red-400 bg-red-100 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded border border-green-400 bg-green-100 px-4 py-2 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/40 dark:text-green-200">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            {children}

            <Button type="submit" className="w-full">
              {submitLabel}
            </Button>

            <div className="pt-1">{footer}</div>
            </div>
          </Card>
        </form>
      </div>
    </PageContainer>
  )
}

