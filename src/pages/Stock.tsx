import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

export default function Stock() {
  const settings = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ purchasePrice: 0, salePrice: 0 });

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

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({
      purchasePrice: product.purchasePrice || 0,
      salePrice: product.salePrice || 0
    });
  };

  const handleSave = async (id: string) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        purchasePrice: Number(editForm.purchasePrice),
        salePrice: Number(editForm.salePrice),
        updatedAt: new Date().toISOString()
      });
      toast.success("Prices updated successfully");
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
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Batch</TableHead>
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
                <TableCell>{product.batchNumber}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.quantity <= settings.minimumStockLimit ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {product.quantity}
                  </span>
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
                    <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>Edit Prices</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-gray-500">
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
