"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api } from "~/trpc/react";

// interface LoginFormValues {
//   password: string;
//   email: string;
//   // acceptTerms: string;
// }

interface AdminForm {
  email: string;
  password: string;
  acceptTerms: boolean;
}

const AdminLogin = () => {
  const router = useRouter();
  const [forgotMode, setForgotMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminForm>();

  const [showPassword, setShowPassword] = useState(false);

  const { mutate: loginMutate, isPending: isLoginPending } = api.admin.login.useMutation({
    onSuccess: ({ user }) => {
      if (user) router.replace("/admin/home");
      toast.success("Login successfully");
    },
    onError: (error) => {
      toast.error(error.message ?? "Login failed");
    },
  });
  const onSubmit = (data: AdminForm) => {
    try {
      if (!data.acceptTerms) {
        toast.error("Please accept the terms and conditions");
        return;
      }
      const { email, password } = data;
      loginMutate({ email, password });
    } catch (error) {
      console.log(error);
      toast.error("Login failed");
    }
  };

  // Forgot password mutations
  const { mutate: sendOtp, isPending: isOtpSending } = api.admin.requestPasswordOtp.useMutation({
    onSuccess: () => {
      toast.success("OTP sent to email");
      setOtpSent(true);
    },
    onError: (error) => toast.error(error.message ?? "Failed to send OTP"),
  });

  const { mutate: resetPassword, isPending: isResetting } = api.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successful. Please login.");
      setForgotMode(false);
      setOtpSent(false);
    },
    onError: (error) => toast.error(error.message ?? "Failed to reset password"),
  });

  // forms for forgot password
  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors },
  } = useForm<{ email: string }>();

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<{ otp: number; newPassword: string }>();

  const onSendOtp = (data: { email: string }) => {
    setResetEmail(data.email);
    sendOtp({ email: data.email });
  };

  const onResetPassword = (data: { otp: number; newPassword: string }) => {
    resetPassword({ email: resetEmail, otp: Number(data.otp), newPassword: data.newPassword });
  };

  return (
    <div className="relative min-h-screen">
      {/* Background Image Container */}
      <div className="fixed inset-0">
        <div className="absolute inset-0">
          <img
            src="/assets/images/bg.png"
            alt="Login background"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Login Form Container */}
      <div className="relative z-10 flex min-h-screen items-center justify-center lg:justify-start px-4 sm:px-6 lg:px-20">
        <div className="relative w-full max-w-md rounded-3xl bg-white px-6 sm:px-8 pb-12 sm:pb-16 pt-14 sm:pt-16">
          {/* Semi Circle and Icon */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="h-12 w-24 rounded-t-full bg-white"></div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <div className="flex h-24 w-24 items-center justify-center rounded-[56px] border-[3px] border-white bg-white p-2">
                  <img
                    src="/assets/images/profile.png"
                    alt="Profile"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Login Content */}
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-semibold text-[#1E293B]">
                Admin Login
              </h1>
              <p className="text-sm text-[#64748B]">
                Welcome! Please enter your information
                <br />
                below and get started.
              </p>
            </div>

            {!forgotMode && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                  })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3.5 text-sm text-[#64748B] placeholder-[#94A3B8] focus:outline-none"
                  placeholder="Email"
                  required
                />
              </div>
              {!forgotMode && errors.email && (
                <div className="text-xs text-red-400">
                  {errors.email.message}
                </div>
              )}

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password", {
                    required: "Password is required",
                  })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3.5 text-sm text-[#64748B] placeholder-[#94A3B8] focus:outline-none"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-[#dadbdd]"
                  >
                    <path
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              {!forgotMode && errors.password && (
                <div className="text-xs text-red-400">
                  {errors.password.message}
                </div>
              )}

              <div className="flex items-center pl-1">
                <div className="relative flex h-5 w-5 items-center">
                  <input
                    type="checkbox"
                    {...register("acceptTerms", {
                      required: "You must accept the terms and conditions",
                    })}
                    className="h-5 w-5 appearance-none rounded border-2 border-[#E2E8F0] checked:bg-[#2563EB]"
                  />
                  {watch("acceptTerms") && (
                    <svg
                      className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <label className="ml-2.5 text-sm text-[#64748B]">
                  Accept Terms and Conditions
                </label>
              </div>
              {errors.acceptTerms && (
                <div className="text-xs text-red-400">
                  {errors.acceptTerms.message}
                </div>
              )}
              <div
                className="text-right text-sm text-blue-600 cursor-pointer"
                onClick={() => router.push("/admin/forgot")}
              >
                Forgot password?
              </div>
              <button
                type="submit"
                className="mt-6 w-full rounded-lg bg-[#2563EB] py-4 text-base font-medium text-white"
              >
                {isLoginPending ? "Logging in..." : "Login"}
              </button>
              </form>
            )}

            {forgotMode && otpSent && (
              <form onSubmit={handleResetSubmit(onResetPassword)} className="space-y-5">
                <input
                  type="number"
                  {...registerReset("otp", { required: "OTP is required" })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3.5 text-sm text-[#64748B] placeholder-[#94A3B8] focus:outline-none"
                  placeholder="OTP"
                />
                {resetErrors.otp && (
                  <div className="text-xs text-red-400">{resetErrors.otp.message}</div>
                )}
                <input
                  type="password"
                  {...registerReset("newPassword", { required: "Password is required" })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3.5 text-sm text-[#64748B] placeholder-[#94A3B8] focus:outline-none"
                  placeholder="New Password"
                />
                {resetErrors.newPassword && (
                  <div className="text-xs text-red-400">{resetErrors.newPassword.message}</div>
                )}
                <button
                  type="submit"
                  className="mt-6 w-full rounded-lg bg-[#2563EB] py-4 text-base font-medium text-white"
                >
                  {isResetting ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
