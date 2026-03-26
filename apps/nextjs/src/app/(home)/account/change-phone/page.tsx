"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export default function ChangePhonePage() {
  const router = useRouter();
  const { data: user } = api.admin.getUser.useQuery();

  // step flags
  const [step, setStep] = useState<"verifyOld" | "verifyNew" | "done">(
    "verifyOld",
  );

  const [oldOtp, setOldOtp] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newOtp, setNewOtp] = useState("");

  const sendOtp = api.auth.sendOtp.useMutation({
    onSuccess: () => toast.success("OTP sent"),
    onError: (err) => toast.error(err.message),
  });

  const updatePhone = api.user.updateCurrentUser.useMutation({
    onSuccess: () => {
      toast.success("Phone number updated");
      setStep("done");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return <div className="p-8">Loading...</div>;

  const maskedPhone = (user.phoneNumber ?? "").replace(/.(?=.{4})/g, "*");

  const handleSendOld = () => {
    sendOtp.mutate({ phoneNumber: user.phoneNumber ?? "" });
  };

  const handleVerifyOld = () => {
    // TODO: call admin.verifyOtp (not implemented yet)
    if (oldOtp.length < 4) {
      toast.error("Enter OTP");
      return;
    }
    setStep("verifyNew");
  };

  const handleSendNew = () => {
    if (newPhone.length < 10) {
      toast.error("Enter valid phone number");
      return;
    }
    sendOtp.mutate({ phoneNumber: newPhone });
  };

  const handleVerifyNew = () => {
    if (newOtp.length < 4) {
      toast.error("Enter OTP");
      return;
    }
    updatePhone.mutate({
      phoneNumber: newPhone,
    });
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center text-2xl font-semibold text-gray-800">
          <Activity className="mr-2 text-blue-500" /> Account Settings
        </h1>
      </div>

      <div className="max-w-lg space-y-6 rounded-xl bg-white p-8 shadow">
        {step === "verifyOld" && (
          <>
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              Change your current phone number
            </h2>
            <p className="mb-6 text-gray-600">
              We will send a verification code to your registered number
              <span className="ml-1 font-medium">{maskedPhone}</span>
            </p>
            <Button
              className="mb-4 w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSendOld}
              disabled={sendOtp.isPending}
            >
              {sendOtp.isPending ? "Sending..." : "Send OTP"}
            </Button>
            <input
              type="number"
              value={oldOtp}
              onChange={(e) => setOldOtp(e.target.value)}
              placeholder="Enter OTP"
              className="mb-4 w-full rounded border p-3"
            />
            <Button
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={handleVerifyOld}
            >
              Verify
            </Button>
          </>
        )}

        {step === "verifyNew" && (
          <>
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              Enter new phone number
            </h2>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="New phone number"
              className="mb-4 w-full rounded border p-3"
            />
            <Button
              className="mb-4 w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSendNew}
              disabled={sendOtp.isPending}
            >
              {sendOtp.isPending ? "Sending..." : "Send OTP"}
            </Button>
            <input
              type="number"
              value={newOtp}
              onChange={(e) => setNewOtp(e.target.value)}
              placeholder="Enter OTP"
              className="mb-4 w-full rounded border p-3"
            />
            <Button
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={handleVerifyNew}
            >
              Update Number
            </Button>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center space-y-4">
            <ShieldCheck className="h-12 w-12 text-green-500" />
            <h2 className="text-lg font-bold text-gray-900">Success</h2>
            <Button
              onClick={() => router.push("/account/change-phone")}
              className="bg-blue-600 text-white"
            >
              Go back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
