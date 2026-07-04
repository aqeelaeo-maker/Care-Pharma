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

export default function Vendors() {
  const settings = useSettings();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', contactInfo: '', address: '', pendingPayment: 0 });

  const fetchVendors = async () => {
    try {
      const querySnapshot = await getDocs(getStoreCollection('vendors'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(data);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
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
      if (editingVendor) {
        await updateDoc(getStoreDoc('vendors', editingVendor.id), formData);
        toast.success("Vendor updated successfully");
      } else {
        await addDoc(getStoreCollection('vendors'), { ...formData, createdAt: new Date().toISOString() });
        toast.success("Vendor added successfully");
      }
      setIsDialogOpen(false);
      fetchVendors();
    } catch (error: any) {
      console.error("Error saving vendor:", error);
      toast.error(error.message || "Failed to save vendor");
    }
  };

  const handleEdit = (vendor: any) => {
    setEditingVendor(vendor);
    setFormData({ name: vendor.name, contactInfo: vendor.contactInfo, address: vendor.address || '', pendingPayment: vendor.pendingPayment || 0 });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      try {
        await deleteDoc(getStoreDoc('vendors', id));
        toast.success("Vendor deleted successfully");
        fetchVendors();
      } catch (error: any) {
        console.error("Error deleting vendor:", error);
        toast.error(error.message || "Failed to delete vendor");
      }
    }
  };

  const openNewDialog = () => {
    setEditingVendor(null);
    setFormData({ name: '', contactInfo: '', address: '', pendingPayment: 0 });
    setIsDialogOpen(true);
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contactInfo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Vendors</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={openNewDialog} />}>
            <Plus className="mr-2 h-4 w-4" /> Add Vendor
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactInfo">Contact Info *</Label>
                <Input id="contactInfo" name="contactInfo" value={formData.contactInfo} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pendingPayment">Pending Payment ({settings.currency})</Label>
                <Input id="pendingPayment" name="pendingPayment" type="number" value={formData.pendingPayment} onChange={handleInputChange} />
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
            placeholder="Search vendors..."
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
              <TableHead>Contact Info</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Pending Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
            ) : filteredVendors.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center">No vendors found</TableCell></TableRow>
            ) : (
              filteredVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.contactInfo}</TableCell>
                  <TableCell>{vendor.address}</TableCell>
                  <TableCell className={vendor.pendingPayment > 0 ? "text-red-600 font-medium" : ""}>
                    {settings.currency}{(vendor.pendingPayment || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(vendor)}>
                      <Edit className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(vendor.id)}>
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
