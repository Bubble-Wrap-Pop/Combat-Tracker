"use client";

import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "@/components/ui/button";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function SignOutButton({
  className,
  variant = "ghost",
  size = "sm",
}: {
  className?: string;
  variant?: ButtonVariant;
  size?: VariantProps<typeof buttonVariants>["size"];
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        variant === "ghost" && "shrink-0 text-zinc-600 dark:text-zinc-400",
        className
      )}
      onClick={() => void signOut()}
    >
      Sign out
    </Button>
  );
}
