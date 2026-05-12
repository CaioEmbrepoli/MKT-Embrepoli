import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#2f2c77",
          night: "#18163f",
          blue: "#34308a",
          steel: "#445069",
          mist: "#f4f6fb",
          line: "#dde2f0"
        }
      },
      boxShadow: {
        panel: "0 16px 45px rgba(24, 22, 63, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
