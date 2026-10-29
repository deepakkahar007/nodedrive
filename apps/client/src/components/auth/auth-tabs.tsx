"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

export function AuthTabs() {
  return (
    <Tabs defaultValue="sign-in">
      <TabsList
        className="h-11 w-full rounded-xl bg-[#eef2fb] p-1 dark:bg-[#202d42]"
        aria-label="Account access"
      >
        <TabsTrigger
          value="sign-in"
          className="rounded-lg data-active:bg-white data-active:text-[#17233d] data-active:shadow-sm dark:data-active:bg-[#33415a] dark:data-active:text-white"
        >
          Sign in
        </TabsTrigger>
        <TabsTrigger
          value="sign-up"
          className="rounded-lg data-active:bg-white data-active:text-[#17233d] data-active:shadow-sm dark:data-active:bg-[#33415a] dark:data-active:text-white"
        >
          Sign up
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in" className="pt-3">
        <SignInForm />
      </TabsContent>
      <TabsContent value="sign-up" className="pt-3">
        <SignUpForm />
      </TabsContent>
    </Tabs>
  );
}
