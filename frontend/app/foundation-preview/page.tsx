import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FoundationShowcase } from "@/test-harness/foundation-showcase";

export const metadata: Metadata = {
  title: "Foundation Verimed V2",
  robots: { index: false, follow: false },
};

export default function FoundationPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_FOUNDATION_HARNESS !== "true") notFound();
  return <FoundationShowcase />;
}
