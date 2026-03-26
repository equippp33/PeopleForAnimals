// tailwind.config.js
import type { Config } from "tailwindcss";
// @ts-expect-error - no types
import nativewind from "nativewind/preset";

import baseConfig from "@acme/tailwind-config/native";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [baseConfig, nativewind],
  theme: {
    extend: {
      fontFamily: {
        regular: ["DMSans-Regular", "sans-serif"],
        bold: ["DMSans-Bold", "sans-serif"],
        semibold: ["DMSans-SemiBold", "sans-serif"], 
        light: ["DMSans-Light", "sans-serif"],
        medium: ["DMSans-Medium", "sans-serif"],
        thin: ["DMSans-Thin", "sans-serif"],
      },
    },
  },
  corePlugins: { 
    opacity: true,
    backgroundColor: true,
    textColor: true,
  },
} satisfies Config;
