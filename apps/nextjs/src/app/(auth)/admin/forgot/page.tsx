"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api } from "~/trpc/react";

interface Step1Form {
  email: string;
}
interface StepOtpForm {
  otp: number;
}
interface StepPwForm {
  newPassword: string;
  confirm: string;
}

const ForgotPassword = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // forms
  const step1 = useForm<Step1Form>();
  const stepOtp = useForm<StepOtpForm>();
  const stepPw = useForm<StepPwForm>();

  // trpc
  const infoQuery = api.admin.getResetInfo.useQuery(
    { email },
    { enabled: false },
  );

  const sendOtp = api.admin.requestPasswordOtp.useMutation({
    onSuccess: () => {
      toast.success("OTP sent");
      setOtpSent(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetPw = api.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated, please login");
      router.push("/admin/login");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // handlers
  const onSubmitEmail = step1.handleSubmit((d) => {
    setEmail(d.email);
    infoQuery
      .refetch()
      .then((res: { data?: { phoneMasked: string }; error?: Error }) => {
        if (res.data) setMaskedPhone(res.data.phoneMasked);
        if (res.error) toast.error(res.error.message);
      });
  });

  const onSendOtp = () => {
    sendOtp.mutate({ email });
  };

  const onVerifyOtp = stepOtp.handleSubmit(() => {
    setVerified(true);
  });

  const onChangePw = stepPw.handleSubmit((d) => {
    if (d.newPassword !== d.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    resetPw.mutate({
      email,
      otp: Number(stepOtp.getValues("otp")),
      newPassword: d.newPassword,
    });
  });

  return (
    <div className="relative min-h-screen">
      {/* Background Image */}
      <div className="fixed inset-0">
        <div className="absolute inset-0">
          <img
            src="/assets/images/bg.png"
            alt="Background"
            className="absolute left-1/2 top-1/2 min-h-[70%] w-full min-w-[100%] -translate-x-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      {/* Form Container */}
      <div className="relative z-10 flex min-h-screen items-center pl-20">
        <div className="relative w-[450px] rounded-3xl bg-white px-8 pb-16 pt-16">
          {/* Semi Circle & Icon */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="h-12 w-24 rounded-t-full bg-white" />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <div className="flex h-24 w-24 items-center justify-center rounded-[56px] border-[3px] border-white bg-white p-2">
                  <img
                    src="/assets/images/profile.png"
                    alt="logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <h2 className="mb-6 mt-6 text-center text-2xl font-semibold text-gray-800">
            Forgot Password
          </h2>

          {/* Step 1 enter email */}
          {!maskedPhone && (
            <form onSubmit={onSubmitEmail} className="space-y-4">
              <input
                type="email"
                {...step1.register("email", { required: "Email is required" })}
                className="w-full rounded border p-3"
                placeholder="Admin Email"
              />
              {step1.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {step1.formState.errors.email.message}
                </p>
              )}
              <button
                className="w-full rounded bg-blue-600 py-3 text-white"
                type="submit"
              >
                Next
              </button>
            </form>
          )}

          {/* show masked phone and send OTP */}
          {maskedPhone && !otpSent && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                We will send an OTP to your registered phone:{" "}
                <span className="font-medium">{maskedPhone}</span>
              </p>
              <button
                onClick={onSendOtp}
                className="w-full rounded bg-blue-600 py-3 text-white"
              >
                {sendOtp.isPending ? "Sending..." : "Send Code"}
              </button>
            </div>
          )}

          {/* verify otp */}
          {otpSent && !verified && (
            <form onSubmit={onVerifyOtp} className="mt-4 space-y-4">
              <input
                type="number"
                {...stepOtp.register("otp", { required: "OTP required" })}
                className="w-full rounded border p-3"
                placeholder="Enter OTP"
              />
              {stepOtp.formState.errors.otp && (
                <p className="text-sm text-red-500">
                  {stepOtp.formState.errors.otp.message}
                </p>
              )}
              <button
                className="w-full rounded bg-blue-600 py-3 text-white"
                type="submit"
              >
                Verify
              </button>
            </form>
          )}

          {/* change password */}
          {verified && (
            <form onSubmit={onChangePw} className="mt-4 space-y-4">
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  {...stepPw.register("newPassword", {
                    required: "New password required",
                  })}
                  className="w-full rounded border p-3 pr-10"
                  placeholder="New Password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  {...stepPw.register("confirm", {
                    required: "Confirm password",
                  })}
                  className="w-full rounded border p-3 pr-10"
                  placeholder="Confirm New Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {(stepPw.formState.errors.newPassword ||
                stepPw.formState.errors.confirm) && (
                <p className="text-sm text-red-500">All fields required</p>
              )}
              <button
                className="w-full rounded bg-blue-600 py-3 text-white"
                type="submit"
              >
                {resetPw.isPending ? "Updating..." : "Change Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
