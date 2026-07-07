import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#E6EFEB", // app background — cool paper
        mist: "#D3E4DC",
        sage: "#A6B8AF", // hairlines
        muted: "#617A6D", // secondary text
        ink: "#1A2922", // near-black green
        surface: "#F2F7F4",
        "surface-sunk": "#DCE8E2",
        gain: "#2C6E49", // single positive accent
        warn: "#A6572E", // muted clay for "invisible" / missing signals
      },
      fontFamily: {
        display: ["var(--font-display)", "GT Alpina", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,41,34,0.04), 0 8px 24px -12px rgba(26,41,34,0.14)",
        lift: "0 2px 4px rgba(26,41,34,0.05), 0 20px 48px -20px rgba(26,41,34,0.22)",
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      transitionTimingFunction: { "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)" },
      zIndex: { sticky: "20", tooltip: "60" },
    },
  },
  plugins: [],
};

export default config;
