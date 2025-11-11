export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter","system-ui","Avenir","Helvetica","Arial"] },
      colors: { ink:"#0F172A", slate:{25:"#F8FAFC"}, brand:{600:"#0F3D91"} },
      boxShadow: { card:"0 2px 8px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)" }
    }
  },
  plugins: []
}
