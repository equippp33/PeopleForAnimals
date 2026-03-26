import type { ReactNode } from "react";
import React, { createContext, useContext, useState } from "react";
interface TabContextType {
  selectedTab: "release" | "capture";
  setSelectedTab: (tab: "release" | "capture") => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTab, setSelectedTab] = useState<"release" | "capture">("capture");

  return (
    <TabContext.Provider value={{ selectedTab, setSelectedTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabContext must be used within a TabProvider");
  }
  return context;
};