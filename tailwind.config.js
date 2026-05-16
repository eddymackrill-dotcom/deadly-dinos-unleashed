/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        scent: "#a45cf2",
        triassic: "#c4905a",
        jurassic: "#5f8a3a",
        cretaceous: "#3a5f4a",
      },
      fontFamily: {
        display: ["Bangers", "sans-serif"],
        ui: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
