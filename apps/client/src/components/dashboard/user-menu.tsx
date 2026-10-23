"use client";

import { User } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export type DashboardUser = {
  name: string;
  email: string;
  image?: string | null;
};

export function UserMenu({ user }: { user: DashboardUser }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Open account menu for ${user.name}`}
        className="cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>
            <User aria-hidden="true" className="size-4" />
          </AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader>
          <PopoverTitle className="truncate">Hi, {user.name}</PopoverTitle>
          <PopoverDescription className="truncate">
            {user.email}
          </PopoverDescription>
        </PopoverHeader>
        <Separator />
        <SignOutButton className="w-full" />
      </PopoverContent>
    </Popover>
  );
}
