import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Printer, Edit } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useReactToPrint } from 'react-to-print';
import { doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Sales() {
  const settings = useSettings();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleToPrint, setSaleToPrint] = useState<any>(null);
  const [saleToEdit, setSaleToEdit] = useState<any>(null);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAmountPaid, setEditAmountPaid] = useState<number | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setSaleToPrint(null)
  });

  useEffect(() => {
    if (saleToPrint) {
      handlePrint();
    }
  }, [saleToPrint, handlePrint]);

  const openEditDialog = (sale: any) => {
    setSaleToEdit(sale);
    setEditDiscount(sale.discount || 0);
    setEditAmountPaid(sale.amountPaid || 0);
  };

  const handleUpdateSale = async () => {
    if (!saleToEdit) return;
    setIsUpdating(true);

    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', saleToEdit.id);

      const newFinalAmount = saleToEdit.totalAmount - editDiscount + saleToEdit.tax;
      const newAmountPaid = editAmountPaid === '' ? 0 : editAmountPaid;
      const newBalance = newFinalAmount - newAmountPaid;

      const oldFinalAmount = saleToEdit.finalAmount;
      const oldAmountPaid = saleToEdit.amountPaid || 0;
      const oldBalance = oldFinalAmount - oldAmountPaid;

      batch.update(saleRef, {
        discount: editDiscount,
        finalAmount: newFinalAmount,
        amountPaid: newAmountPaid,
        paymentStatus: newBalance > 0 ? 'Partial' : 'Paid'
      });

      if (saleToEdit.customerId) {
        const customerRef = doc(db, 'customers', saleToEdit.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const currentLoan = customerSnap.data().loanAmount || 0;
          const newLoan = currentLoan - oldBalance + newBalance;
          batch.update(customerRef, { loanAmount: newLoan });
        }
      }

      await batch.commit();
      toast.success("Sale updated successfully");
      setSaleToEdit(null);
      
      // Refresh sales
      const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      setSales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Failed to update sale");
    } finally {
      setIsUpdating(false);
    }
  };

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
                  <TableCell>{settings.currency}{sale.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>{settings.currency}{sale.discount.toFixed(2)}</TableCell>
                  <TableCell>{settings.currency}{sale.tax.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">{settings.currency}{sale.finalAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSaleToPrint(sale)}>
                      <Printer className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(sale)}>
                      <Edit className="h-4 w-4 text-green-600" />
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
                      <TableCell>{settings.currency}{item.salePrice.toFixed(2)}</TableCell>
                      <TableCell>{settings.currency}{item.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-end">
                <div className="w-48 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal:</span> <span>{settings.currency}{selectedSale.totalAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Discount:</span> <span>{settings.currency}{selectedSale.discount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax:</span> <span>{settings.currency}{selectedSale.tax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span> <span>{settings.currency}{selectedSale.finalAmount.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!saleToEdit} onOpenChange={(open) => !open && setSaleToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {saleToEdit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Discount</Label>
                <Input 
                  type="number" 
                  value={editDiscount} 
                  onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input 
                  type="number" 
                  value={editAmountPaid} 
                  onChange={(e) => setEditAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{settings.currency}{saleToEdit.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{settings.currency}{saleToEdit.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>New Total:</span>
                  <span>{settings.currency}{(saleToEdit.totalAmount - editDiscount + saleToEdit.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>New Balance:</span>
                  <span>{settings.currency}{Math.max(0, (saleToEdit.totalAmount - editDiscount + saleToEdit.tax) - (editAmountPaid === '' ? 0 : editAmountPaid)).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setSaleToEdit(null)}>Cancel</Button>
                <Button onClick={handleUpdateSale} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden Print Component */}
      <div className="hidden">
        <div ref={printRef} className="p-10 w-[210mm] min-h-[297mm] bg-white text-black">
          {saleToPrint && (
            <>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-4xl font-bold text-blue-600 mb-2">{settings.storeName}</h1>
                  <p className="text-gray-600">{settings.address}</p>
                  <p className="text-gray-600">Tel: {settings.phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h2>
                  <p className="text-gray-600">Date: {new Date(saleToPrint.date).toLocaleDateString()}</p>
                  <p className="text-gray-600">Time: {new Date(saleToPrint.date).toLocaleTimeString()}</p>
                  <p className="text-gray-600">Invoice #: {saleToPrint.id}</p>
                </div>
              </div>
              
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold border-b pb-2 mb-2">Bill To:</h3>
                <p className="font-bold text-xl text-gray-800">{saleToPrint.customerName}</p>
              </div>

              <table className="w-full mb-8 border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="text-left py-3 px-4 font-semibold">Item Description</th>
                    <th className="text-center py-3 px-4 font-semibold">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold">Unit Price</th>
                    <th className="text-right py-3 px-4 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleToPrint.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{item.productName}</div>
                        <div className="text-sm text-gray-500">Batch: {item.batchNumber}</div>
                      </td>
                      <td className="text-center py-3 px-4">{item.quantity}</td>
                      <td className="text-right py-3 px-4">{settings.currency}{item.salePrice.toFixed(2)}</td>
                      <td className="text-right py-3 px-4 font-medium">{settings.currency}{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-medium">{settings.currency}{saleToPrint.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{settings.currency}{saleToPrint.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax:</span>
                    <span className="font-medium">{settings.currency}{saleToPrint.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold border-t-2 border-gray-800 pt-3 mt-3">
                    <span>Total:</span>
                    <span className="text-blue-600">{settings.currency}{saleToPrint.finalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 mt-2">
                    <span>Amount Paid:</span>
                    <span className="font-medium">{settings.currency}{saleToPrint.amountPaid?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
