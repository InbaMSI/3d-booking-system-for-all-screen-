"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

export function HeroLinkButton({ children, href }: { children: ReactNode; href: string }) {
  const router = useRouter();
  return <Button className="button button-primary" onPress={() => router.push(href)}>{children}</Button>;
}
