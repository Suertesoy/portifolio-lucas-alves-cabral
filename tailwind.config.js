/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-elev-2": "var(--bg-elev-2)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        "line-green": "var(--line-green)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "accent-soft": "var(--accent-soft)",
        glow: "var(--glow)",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      maxWidth: {
        container: "var(--container-max)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(.22,.61,.36,1)",
      },
    },
  },
  plugins: [],
};
