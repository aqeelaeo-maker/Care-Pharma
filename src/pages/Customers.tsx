import React, { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, getStoreCollection, getStoreDoc } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function Customers() {
  const settings = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', points: 0, loanAmount: 0 });

  const fetchCustomers = async () => {
    try {
      const querySnapshot = await getDocs(getStoreCollection('customers'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updateDoc(getStoreDoc('customers', editingCustomer.id), formData);
        toast.success("Customer updated successfully");
      } else {
        await addDoc(getStoreCollection('customers'), { ...formData, createdAt: new Date().toISOString() });
        toast.success("Customer added successfully");
      }
      setIsDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error(error.message || "Failed to save customer");
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '', points: customer.points || 0, loanAmount: customer.loanAmount || 0 });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      try {
        await deleteDoc(getStoreDoc('customers', id));
        toast.success("Customer deleted successfully");
        fetchCustomers();
      } catch (error: any) {
        console.error("Error deleting customer:", error);
        toast.error(error.message || "Failed to delete customer");
      }
    }
  };

  const openNewDialog = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '', points: 0, loanAmount: 0 });
    setIsDialogOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={openNewDialog} />}>
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Loyalty Points</Label>
                <Input id="points" name="points" type="number" value={formData.points} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanAmount">Loan Amount ({settings.currency})</Label>
                <Input id="loanAmount" name="loanAmount" type="number" value={formData.loanAmount} onChange={handleInputChange} />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search customers..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Loan Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">No customers found</TableCell></TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.address}</TableCell>
                  <TableCell>{customer.points}</TableCell>
                  <TableCell className={customer.loanAmount > 0 ? "text-red-600 font-medium" : ""}>
                    {settings.currency}{(customer.loanAmount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                      <Edit className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
