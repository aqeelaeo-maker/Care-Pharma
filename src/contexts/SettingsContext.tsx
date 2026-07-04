import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';

interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxRate: number;
  currency: string;
  minimumStockLimit: number;
  authorizedEmails?: string;
}

const defaultSettings: StoreSettings = {
  storeName: 'PharmaCare',
  address: '123 Health Street, City',
  phone: '+1 234 567 890',
  taxRate: 5,
  currency: '$',
  minimumStockLimit: 10,
  authorizedEmails: ''
};

const SettingsContext = createContext<StoreSettings>(defaultSettings);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);

  useEffect(() => {
    let unsubSnapshot: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        unsubSnapshot = onSnapshot(doc(db, 'stores', user.email.toLowerCase(), 'settings', 'store'), (docSnap) => {
          if (docSnap.exists()) {
            setSettings({ ...defaultSettings, ...docSnap.data() } as StoreSettings);
          } else {
            setSettings(defaultSettings);
          }
        }, (error) => {
          console.error("Error fetching settings:", error);
        });
      } else {
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = undefined;
        }
        setSettings(defaultSettings);
      }
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) {
        unsubSnapshot();
      }
    };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
};
