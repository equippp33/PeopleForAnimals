"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

export default function LogoutPage() {
  const router = useRouter();
  const signOut = api.auth.signOut.useMutation({
    onSuccess: () => {
      toast.success("Signed out successfully");
      router.replace("/admin/login");
    },
    onError: (err) => {
      toast.error(err.message);
      router.replace("/admin/login");
    },
  });

  useEffect(() => {
    signOut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg font-semibold">Logging out...</p>
    </div>
  );
}
