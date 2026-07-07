"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface SettingsContextValue {
  lowDataMode: boolean;
  setLowDataMode: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  lowDataMode: false,
  setLowDataMode: () => {},
});

const KEY = "partizo_low_data_mode";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lowDataMode, setLowDataModeState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(KEY);
    if (saved) setLowDataModeState(saved === "1");
  }, []);

  const setLowDataMode = (value: boolean) => {
    setLowDataModeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    }
  };

  const value = useMemo(() => ({ lowDataMode, setLowDataMode }), [lowDataMode]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
