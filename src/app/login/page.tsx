import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#13161e] flex items-center justify-center">
          <div className="w-10 h-10 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
