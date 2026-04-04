import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

export default function Sales() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        setSales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error("Failed to load sales");
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Sales History</h1>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
            ) : sales.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center">No sales found</TableCell></TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{new Date(sale.date).toLocaleString()}</TableCell>
                  <TableCell>{sale.customerName}</TableCell>
                  <TableCell>{sale.items.length}</TableCell>
                  <TableCell>${sale.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>${sale.discount.toFixed(2)}</TableCell>
                  <TableCell>${sale.tax.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">${sale.finalAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Date:</span> {new Date(selectedSale.date).toLocaleString()}</div>
                <div><span className="font-semibold">Customer:</span> {selectedSale.customerName}</div>
                <div><span className="font-semibold">Sale ID:</span> {selectedSale.id}</div>
              </div>
              
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
                  {selectedSale.items.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${item.salePrice.toFixed(2)}</TableCell>
                      <TableCell>${item.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-end">
                <div className="w-48 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal:</span> <span>${selectedSale.totalAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Discount:</span> <span>${selectedSale.discount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax:</span> <span>${selectedSale.tax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span> <span>${selectedSale.finalAmount.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
