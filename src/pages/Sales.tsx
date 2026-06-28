import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Printer, Edit, Trash2, Plus, Ticket } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useReactToPrint } from 'react-to-print';
import { doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Sales() {
  const settings = useSettings();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleToPrintA4, setSaleToPrintA4] = useState<any>(null);
  const [saleToPrintThermal, setSaleToPrintThermal] = useState<any>(null);
  const [saleToEdit, setSaleToEdit] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAmountPaid, setEditAmountPaid] = useState<number | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const printA4Ref = useRef<HTMLDivElement>(null);
  const printThermalRef = useRef<HTMLDivElement>(null);

  const editSubtotal = editItems.reduce((sum, item) => sum + item.total, 0);
  const editTaxAmount = (editSubtotal * settings.taxRate) / 100;
  const editFinalAmount = editSubtotal - editDiscount + editTaxAmount;
  const editBalance = editFinalAmount - (editAmountPaid === '' ? 0 : editAmountPaid);

  const handlePrintA4Action = useReactToPrint({
    contentRef: printA4Ref,
    onAfterPrint: () => setSaleToPrintA4(null)
  });

  const handlePrintThermalAction = useReactToPrint({
    contentRef: printThermalRef,
    onAfterPrint: () => setSaleToPrintThermal(null)
  });

  useEffect(() => {
    if (saleToPrintA4) {
      handlePrintA4Action();
    }
  }, [saleToPrintA4, handlePrintA4Action]);

  useEffect(() => {
    if (saleToPrintThermal) {
      handlePrintThermalAction();
    }
  }, [saleToPrintThermal, handlePrintThermalAction]);

  const openEditDialog = (sale: any) => {
    setSaleToEdit(sale);
    setEditItems([...sale.items]);
    setEditDiscount(sale.discount || 0);
    setEditAmountPaid(sale.amountPaid || 0);
    setSelectedProductToAdd('');
  };

  const handleAddEditItem = () => {
    if (!selectedProductToAdd) return;
    const product = products.find(p => p.id === selectedProductToAdd);
    if (!product) return;

    const existingItem = editItems.find(item => item.productId === product.id);
    if (existingItem) {
      setEditItems(editItems.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.salePrice }
          : item
      ));
    } else {
      setEditItems([...editItems, {
        productId: product.id,
        productName: product.name,
        batchNumber: product.batchNumber,
        expiryDate: product.expiryDate,
        salePrice: product.salePrice,
        quantity: 1,
        total: product.salePrice
      }]);
    }
    setSelectedProductToAdd('');
  };

  const handleRemoveEditItem = (productId: string) => {
    setEditItems(editItems.filter(item => item.productId !== productId));
  };

  const handleUpdateEditItemQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) return;
    setEditItems(editItems.map(item => 
      item.productId === productId 
        ? { ...item, quantity: newQty, total: newQty * item.salePrice }
        : item
    ));
  };

  const handleUpdateSale = async () => {
    if (!saleToEdit) return;
    if (editItems.length === 0) {
      toast.error("Sale must have at least one item");
      return;
    }
    setIsUpdating(true);

    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', saleToEdit.id);

      const newAmountPaid = editAmountPaid === '' ? 0 : editAmountPaid;

      const oldFinalAmount = saleToEdit.finalAmount;
      const oldAmountPaid = saleToEdit.amountPaid || 0;
      const oldBalance = oldFinalAmount - oldAmountPaid;

      // Stock adjustments
      const oldQtyMap = new Map<string, number>(saleToEdit.items.map((i: any) => [i.productId, i.quantity]));
      const newQtyMap = new Map<string, number>(editItems.map((i: any) => [i.productId, i.quantity]));
      const allProductIds = new Set<string>([...oldQtyMap.keys(), ...newQtyMap.keys()]);

      for (const productId of allProductIds) {
        const oldQty = oldQtyMap.get(productId) || 0;
        const newQty = newQtyMap.get(productId) || 0;
        const diff = newQty - oldQty;
        
        if (diff !== 0) {
          const productRef = doc(db, 'products', productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const currentStock = productSnap.data().quantity || 0;
            batch.update(productRef, { quantity: currentStock - diff });
          }
        }
      }

      batch.update(saleRef, {
        items: editItems,
        discount: editDiscount,
        totalAmount: editSubtotal,
        tax: editTaxAmount,
        finalAmount: editFinalAmount,
        amountPaid: newAmountPaid,
        paymentStatus: editBalance > 0 ? 'Partial' : 'Paid'
      });

      if (saleToEdit.customerId) {
        const customerRef = doc(db, 'customers', saleToEdit.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const currentLoan = customerSnap.data().loanAmount || 0;
          const newLoan = currentLoan - oldBalance + editBalance;
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
    const fetchData = async () => {
      try {
        const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        setSales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const pQuery = query(collection(db, 'products'));
        const pSnapshot = await getDocs(pQuery);
        setProducts(pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)} title="View Details">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSaleToPrintThermal(sale)} title="Thermal Receipt">
                      <Ticket className="h-4 w-4 text-orange-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSaleToPrintA4(sale)} title="A4 Invoice">
                      <Printer className="h-4 w-4 text-gray-800" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(sale)} title="Edit Sale">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {saleToEdit && (
            <div className="space-y-4">
              <div className="border p-4 rounded-md space-y-4">
                <h3 className="font-semibold">Items</h3>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                      <SelectTrigger><SelectValue placeholder="Select product to add..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} - {settings.currency}{p.salePrice.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddEditItem} disabled={!selectedProductToAdd}>
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {editItems.map(item => (
                    <div key={item.productId} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.productName}</div>
                        <div className="text-xs text-gray-500">{settings.currency}{item.salePrice.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input 
                          type="number" 
                          className="w-16 h-8 text-center" 
                          value={item.quantity}
                          onChange={(e) => handleUpdateEditItemQuantity(item.productId, parseInt(e.target.value))}
                        />
                        <div className="font-medium w-16 text-right">{settings.currency}{item.total.toFixed(2)}</div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveEditItem(item.productId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{settings.currency}{editSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{settings.currency}{editTaxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>New Total:</span>
                  <span>{settings.currency}{editFinalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>New Balance:</span>
                  <span>{settings.currency}{Math.max(0, editBalance).toFixed(2)}</span>
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

      {/* Hidden Print Components */}
      <div className="hidden">
        {/* Thermal Receipt */}
        <div ref={printThermalRef} className="p-4 w-[80mm] text-black font-sans bg-white">
          {saleToPrintThermal && (
            <>
              <div className="text-center mb-4">
                <h1 className="font-bold text-2xl uppercase tracking-wider">{settings.storeName}</h1>
                <p className="text-xs text-gray-600 mt-1">{settings.address}</p>
                <p className="text-xs text-gray-600">Tel: {settings.phone}</p>
              </div>
              
              <div className="border-y border-dashed border-gray-400 py-2 mb-3 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium">{new Date(saleToPrintThermal.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Invoice No:</span>
                  <span className="font-bold">{saleToPrintThermal.invoiceNumber || saleToPrintThermal.id.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-medium">{saleToPrintThermal.customerName}</span>
                </div>
              </div>

              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-600 uppercase tracking-wider">
                    <th className="py-2 text-left w-3/5">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {saleToPrintThermal.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 border-dashed">
                      <td className="py-2 pr-2">
                        <div className="font-bold text-gray-800 leading-tight">{item.productName}</div>
                      </td>
                      <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-600">{Math.round(item.salePrice)}</td>
                      <td className="py-2 text-right font-bold">{Math.round(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-800 pt-2 mb-4 space-y-1 text-sm bg-gray-50/50 p-2 rounded-md">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Subtotal:</span>
                  <span>{settings.currency}{saleToPrintThermal.totalAmount.toFixed(2)}</span>
                </div>
                {saleToPrintThermal.discount > 0 && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Discount:</span>
                    <span>-{settings.currency}{saleToPrintThermal.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-600">
                  <span>Tax ({settings.taxRate}%):</span>
                  <span>{settings.currency}{saleToPrintThermal.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg pt-1 border-t border-gray-300 mt-1">
                  <span>Total:</span>
                  <span>{settings.currency}{saleToPrintThermal.finalAmount.toFixed(2)}</span>
                </div>
                {saleToPrintThermal.amountPaid !== undefined && saleToPrintThermal.amountPaid !== null && (
                  <div className="flex justify-between items-center text-gray-600 mt-2">
                    <span>Amount Paid:</span>
                    <span>{settings.currency}{Number(saleToPrintThermal.amountPaid).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-400">
                <p className="font-medium text-gray-800 text-sm">Thank you for visiting!</p>
                <p className="text-xs text-gray-500 mt-1">Goods once sold cannot be returned.</p>
              </div>
            </>
          )}
        </div>

        {/* A4 Invoice */}
        <div ref={printA4Ref} className="p-10 w-[210mm] min-h-[297mm] bg-white text-black">
          {saleToPrintA4 && (
            <>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-4xl font-bold text-blue-600 mb-2">{settings.storeName}</h1>
                  <p className="text-gray-600">{settings.address}</p>
                  <p className="text-gray-600">Tel: {settings.phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h2>
                  <p className="text-gray-600 font-medium">Invoice #: {saleToPrintA4.invoiceNumber || saleToPrintA4.id.substring(0, 8)}</p>
                  <p className="text-gray-600">Date: {new Date(saleToPrintA4.date).toLocaleDateString()}</p>
                  <p className="text-gray-600">Time: {new Date(saleToPrintA4.date).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold border-b pb-2 mb-2">Bill To:</h3>
                <p className="font-bold text-xl text-gray-800">{saleToPrintA4.customerName}</p>
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
                  {saleToPrintA4.items.map((item: any, i: number) => (
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
                    <span className="font-medium">{settings.currency}{saleToPrintA4.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{settings.currency}{saleToPrintA4.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({settings.taxRate}%):</span>
                    <span className="font-medium">{settings.currency}{saleToPrintA4.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold border-t-2 border-gray-800 pt-3 mt-3">
                    <span>Total:</span>
                    <span className="text-blue-600">{settings.currency}{saleToPrintA4.finalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 mt-2">
                    <span>Amount Paid:</span>
                    <span className="font-medium">{settings.currency}{saleToPrintA4.amountPaid?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-800">
                <p className="mb-2 font-semibold">I Muhammad Saqib a person resident in Pakistan Carrying on bussiness at 1-282. Street # 4Mohallah Qutb-u-Din Committee Chowk Rawalpindi Under the name of Israh Distributors Do here by give this warranty the drug described as sold in this invoice do not contravense in any way the provision of section 23 of the Drug Act 1976.</p>
                <p className="font-semibold">NOTE (1)Herbal/natural/Nutrinational/Surgical /Food item are not covered under this warranty</p>
                <p className="mb-8 font-semibold">(2)For dated items we must be informed six months prior to expiry (3)(*)Marked item are not covered under this warranty (4)This Warranty is suspended /cancelled in cause of your license is expired</p>
                <div className="text-right mt-12 font-bold text-lg">
                  For Israh Distributors
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
