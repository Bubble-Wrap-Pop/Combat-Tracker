import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
    <PageContainer className="flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <form action={action}>
          <Card>
            <h1 className="text-2xl font-semibold text-center mb-4 text-zinc-900 dark:text-white">
              {title}
            </h1>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded text-sm dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 rounded-lg text-zinc-900 dark:text-white w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 rounded-lg text-zinc-900 dark:text-white w-full"
              />
            </div>

            {children}

            <Button type="submit" className="mt-2 w-full">
              {submitLabel}
            </Button>

              {footer}
          </Card>
        </form>
      </div>
    </PageContainer>
  )
}

