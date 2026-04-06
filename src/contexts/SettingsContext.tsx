import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxRate: number;
  currency: string;
  minimumStockLimit: number;
}

const defaultSettings: StoreSettings = {
  storeName: 'PharmaCare',
  address: '123 Health Street, City',
  phone: '+1 234 567 890',
  taxRate: 5,
  currency: '$',
  minimumStockLimit: 10
};

const SettingsContext = createContext<StoreSettings>(defaultSettings);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'store'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() } as StoreSettings);
      }
    });
    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
};
