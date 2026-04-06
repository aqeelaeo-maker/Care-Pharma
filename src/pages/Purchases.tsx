import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorId: '',
    vendorName: '',
    date: new Date().toISOString().split('T')[0],
    amountPaid: '' as number | ''
  });
  
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productId: '', productName: '', batchNumber: '', expiryDate: '', quantity: 0, purchasePrice: 0
  });

  const fetchData = async () => {
    try {
      const [purchasesSnap, vendorsSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'products'))
      ]);
      
      setPurchases(purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVendorChange = (value: string) => {
    const vendor = vendors.find(v => v.id === value);
    setFormData({ ...formData, vendorId: value, vendorName: vendor?.name || '' });
  };

  const handleProductChange = (value: string) => {
    const product = products.find(p => p.id === value);
    setCurrentItem({
      ...currentItem,
      productId: value,
      productName: product?.name || '',
      batchNumber: product?.batchNumber || '',
      expiryDate: product?.expiryDate || '',
      purchasePrice: product?.purchasePrice || 0
    });
  };

  const handleAddItem = () => {
    if (!currentItem.productId || currentItem.quantity <= 0) {
      toast.error("Please select a product and enter a valid quantity");
      return;
    }
    setPurchaseItems([...purchaseItems, currentItem]);
    setCurrentItem({ productId: '', productName: '', batchNumber: '', expiryDate: '', quantity: 0, purchasePrice: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    try {
      const totalAmount = purchaseItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);
      const amountPaid = formData.amountPaid === '' ? 0 : formData.amountPaid;
      const balance = totalAmount - amountPaid;
      
      const purchaseData = {
        ...formData,
        amountPaid,
        paymentStatus: balance > 0 ? 'Partial' : 'Paid',
        totalAmount,
        items: purchaseItems,
        createdAt: new Date().toISOString()
      };

      const batch = writeBatch(db);

      // Add purchase record
      const purchaseRef = doc(collection(db, 'purchases'));
      batch.set(purchaseRef, purchaseData);

      // Update vendor pending payment
      if (balance > 0 && formData.vendorId) {
        const vendorRef = doc(db, 'vendors', formData.vendorId);
        const vendorSnap = await getDoc(vendorRef);
        if (vendorSnap.exists()) {
          batch.update(vendorRef, {
            pendingPayment: (vendorSnap.data().pendingPayment || 0) + balance
          });
        }
      }

      // Update product quantities and add stock logs
      for (const item of purchaseItems) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const currentQty = productSnap.data().quantity || 0;
          batch.update(productRef, { 
            quantity: currentQty + item.quantity,
            updatedAt: new Date().toISOString()
          });

          // Add stock log
          const logRef = doc(collection(db, 'stockLogs'));
          batch.set(logRef, {
            productId: item.productId,
            productName: item.productName,
            type: 'IN',
            quantity: item.quantity,
            referenceId: purchaseRef.id,
            date: new Date().toISOString()
          });
        }
      }

      await batch.commit();
      toast.success("Purchase recorded successfully");
      setIsDialogOpen(false);
      setPurchaseItems([]);
      setFormData({ vendorId: '', vendorName: '', date: new Date().toISOString().split('T')[0], amountPaid: '' });
      fetchData();
    } catch (error: any) {
      console.error("Error saving purchase:", error);
      toast.error(error.message || "Failed to save purchase");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Purchases</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> New Purchase
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Purchase</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor *</Label>
                  <Select value={formData.vendorId} onValueChange={handleVendorChange} required>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>

              <div className="border p-4 rounded-md space-y-4">
                <h3 className="font-medium">Add Items</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-2">
                    <Label>Product</Label>
                    <Select value={currentItem.productId} onValueChange={handleProductChange}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input type="number" value={currentItem.quantity || ''} onChange={e => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                  <div>
                    <Label>Price</Label>
                    <Input type="number" step="0.01" value={currentItem.purchasePrice || ''} onChange={e => setCurrentItem({...currentItem, purchasePrice: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <Button type="button" onClick={handleAddItem} className="w-full">Add Item</Button>
                  </div>
                </div>

                {purchaseItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${item.purchasePrice.toFixed(2)}</TableCell>
                          <TableCell>${(item.quantity * item.purchasePrice).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">Total:</TableCell>
                        <TableCell className="font-bold">
                          ${purchaseItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-2">
                <Label>Amount Paid ($)</Label>
                <Input 
                  type="number" 
                  value={formData.amountPaid} 
                  onChange={e => setFormData({...formData, amountPaid: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Purchase</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">No purchases found</TableCell></TableRow>
            ) : (
              purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{new Date(purchase.date).toLocaleDateString()}</TableCell>
                  <TableCell>{purchase.vendorName}</TableCell>
                  <TableCell>{purchase.items.length} items</TableCell>
                  <TableCell>${purchase.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>${(purchase.amountPaid || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      purchase.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {purchase.paymentStatus || 'Paid'}
                    </span>
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
