// frontend/src/ThemeContext.js
import React, { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext({
  dark: false,
  toggle: () => {}
});

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const v = localStorage.getItem("ingres_dark");
    return v === "1" ? true : false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("ingres_dark", "1");
    } else {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("ingres_dark", "0");
    }
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
