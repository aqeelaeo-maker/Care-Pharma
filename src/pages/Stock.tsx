import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

export default function Stock() {
  const settings = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    purchasePrice: 0, 
    salePrice: 0,
    batchNumber: '',
    expiryDate: '',
    quantity: 0,
    barcode: ''
  });

  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [addStockForm, setAddStockForm] = useState({
    productId: '',
    quantityToAdd: 0,
    batchNumber: '',
    expiryDate: '',
    barcode: '',
    purchasePrice: 0,
    salePrice: 0
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setAddStockForm({
        productId,
        quantityToAdd: 0,
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        barcode: product.barcode || '',
        purchasePrice: product.purchasePrice || 0,
        salePrice: product.salePrice || 0
      });
    }
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockForm.productId) {
      toast.error("Please select a product");
      return;
    }
    try {
      const product = products.find(p => p.id === addStockForm.productId);
      const productRef = doc(db, 'products', addStockForm.productId);
      
      const newQuantity = (product.quantity || 0) + Number(addStockForm.quantityToAdd);

      await updateDoc(productRef, {
        quantity: newQuantity,
        batchNumber: addStockForm.batchNumber,
        expiryDate: addStockForm.expiryDate,
        barcode: addStockForm.barcode,
        purchasePrice: Number(addStockForm.purchasePrice),
        salePrice: Number(addStockForm.salePrice),
        updatedAt: new Date().toISOString()
      });
      
      toast.success("Stock added successfully");
      setIsAddStockOpen(false);
      setAddStockForm({
        productId: '',
        quantityToAdd: 0,
        batchNumber: '',
        expiryDate: '',
        barcode: '',
        purchasePrice: 0,
        salePrice: 0
      });
      fetchProducts();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Failed to add stock");
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({
      purchasePrice: product.purchasePrice || 0,
      salePrice: product.salePrice || 0,
      batchNumber: product.batchNumber || '',
      expiryDate: product.expiryDate || '',
      quantity: product.quantity || 0,
      barcode: product.barcode || ''
    });
  };

  const handleSave = async (id: string) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        purchasePrice: Number(editForm.purchasePrice),
        salePrice: Number(editForm.salePrice),
        batchNumber: editForm.batchNumber,
        expiryDate: editForm.expiryDate,
        quantity: Number(editForm.quantity),
        barcode: editForm.barcode,
        updatedAt: new Date().toISOString()
      });
      toast.success("Stock details updated successfully");
      setEditingId(null);
      fetchProducts();
    } catch (error) {
      console.error("Error updating prices:", error);
      toast.error("Failed to update prices");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Stock & Pricing</h1>
        <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
          <DialogTrigger render={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Stock
            </Button>
          } />
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Stock</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Product *</Label>
                <Select value={addStockForm.productId} onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {addStockForm.productId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity to Add *</Label>
                      <Input 
                        type="number" 
                        required 
                        min="1"
                        value={addStockForm.quantityToAdd || ''} 
                        onChange={e => setAddStockForm({...addStockForm, quantityToAdd: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Barcode</Label>
                      <Input 
                        value={addStockForm.barcode} 
                        onChange={e => setAddStockForm({...addStockForm, barcode: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Batch Number</Label>
                      <Input 
                        value={addStockForm.batchNumber} 
                        onChange={e => setAddStockForm({...addStockForm, batchNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input 
                        type="date" 
                        value={addStockForm.expiryDate} 
                        onChange={e => setAddStockForm({...addStockForm, expiryDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cost Price *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        required 
                        value={addStockForm.purchasePrice} 
                        onChange={e => setAddStockForm({...addStockForm, purchasePrice: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sale Price *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        required 
                        value={addStockForm.salePrice} 
                        onChange={e => setAddStockForm({...addStockForm, salePrice: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddStockOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Stock</Button>
                  </div>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Sale Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      value={editForm.batchNumber} 
                      onChange={(e) => setEditForm({...editForm, batchNumber: e.target.value})}
                      className="w-24"
                    />
                  ) : (
                    product.batchNumber
                  )}
                </TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      type="date"
                      value={editForm.expiryDate} 
                      onChange={(e) => setEditForm({...editForm, expiryDate: e.target.value})}
                      className="w-36"
                    />
                  ) : (
                    product.expiryDate
                  )}
                </TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      value={editForm.barcode} 
                      onChange={(e) => setEditForm({...editForm, barcode: e.target.value})}
                      className="w-32"
                    />
                  ) : (
                    product.barcode
                  )}
                </TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      type="number" 
                      value={editForm.quantity} 
                      onChange={(e) => setEditForm({...editForm, quantity: parseInt(e.target.value) || 0})}
                      className="w-24"
                    />
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.quantity <= settings.minimumStockLimit ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {product.quantity}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      type="number" 
                      value={editForm.purchasePrice} 
                      onChange={(e) => setEditForm({...editForm, purchasePrice: parseFloat(e.target.value) || 0})}
                      className="w-24"
                    />
                  ) : (
                    `${settings.currency}${(product.purchasePrice || 0).toFixed(2)}`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === product.id ? (
                    <Input 
                      type="number" 
                      value={editForm.salePrice} 
                      onChange={(e) => setEditForm({...editForm, salePrice: parseFloat(e.target.value) || 0})}
                      className="w-24"
                    />
                  ) : (
                    `${settings.currency}${(product.salePrice || 0).toFixed(2)}`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === product.id ? (
                    <div className="flex justify-end space-x-2">
                      <Button size="sm" onClick={() => handleSave(product.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>Edit Details</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-gray-500">
                  No products found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
