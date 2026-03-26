import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';

interface TabContextType {
  activeTab: 'surgery' | 'release';
  setActiveTab: (tab: 'surgery' | 'release') => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<'surgery' | 'release'>('surgery');

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within a TabProvider');
  }
  return context;
};