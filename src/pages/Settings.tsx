import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Settings() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'PharmaCare',
    address: '123 Health Street, City',
    phone: '+1 234 567 890',
    taxRate: 5,
    currency: '$',
    minimumStockLimit: 10,
    authorizedEmails: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const settingsDoc = await getDoc(doc(db, 'settings', 'store'));
        if (settingsDoc.exists()) {
          setStoreSettings(settingsDoc.data() as any);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("User role updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleStoreSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setStoreSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const saveStoreSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'store'), storeSettings);
      toast.success("Store settings saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Store Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input name="storeName" value={storeSettings.storeName} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" value={storeSettings.phone} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Address</Label>
              <Input name="address" value={storeSettings.address} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Authorized Emails (comma-separated, empty to allow all)</Label>
              <Input name="authorizedEmails" placeholder="e.g. admin@example.com, staff@example.com" value={storeSettings.authorizedEmails || ''} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input name="taxRate" type="number" value={storeSettings.taxRate} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input name="currency" value={storeSettings.currency} onChange={handleStoreSettingsChange} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Stock Limit</Label>
              <Input name="minimumStockLimit" type="number" value={storeSettings.minimumStockLimit} onChange={handleStoreSettingsChange} />
            </div>
            <div className="col-span-2 flex justify-end mt-4">
              <Button onClick={saveStoreSettings}>Save Settings</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select 
                        value={user.role} 
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Pharmacist">Pharmacist</SelectItem>
                          <SelectItem value="Staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
