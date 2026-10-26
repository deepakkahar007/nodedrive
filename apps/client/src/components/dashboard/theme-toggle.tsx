"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const ActiveIcon =
    themes.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Change theme"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
      >
        {mounted ? (
          <ActiveIcon aria-hidden="true" />
        ) : (
          <Monitor aria-hidden="true" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 gap-0 p-1">
        {themes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mounted && theme === value}
            onClick={() => setTheme(value)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
