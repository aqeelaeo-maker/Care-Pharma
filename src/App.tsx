import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Toaster } from '@/components/ui/sonner';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import POS from './pages/POS';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

import { SettingsProvider } from './contexts/SettingsContext';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          if (!firebaseUser.email) {
            setUser({ ...firebaseUser, role: 'Staff' });
            return;
          }
          const userDoc = await getDoc(doc(db, 'stores', firebaseUser.email.toLowerCase(), 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ ...firebaseUser, role: userDoc.data().role });
          } else {
            setUser({ ...firebaseUser, role: 'Admin' });
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <SettingsProvider>
      <Router>
        <Routes>
          <Route path="/login" element={!user ? <AuthLayout><Login /></AuthLayout> : <Navigate to="/" />} />
          
          <Route path="/" element={user ? <MainLayout user={user} /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="stock" element={<Stock />} />
            <Route path="customers" element={<Customers />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="sales" element={<Sales />} />
            <Route path="pos" element={<POS user={user} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
    </SettingsProvider>
  );
}
