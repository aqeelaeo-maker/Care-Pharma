import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Trash2, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function POS({ user }: { user: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [cart, setCart] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // e.g., 5 for 5%
  const [loading, setLoading] = useState(false);
  
  const thermalReceiptRef = useRef(null);
  const a4ReceiptRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsSnap, customersSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'customers'))
        ]);
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        toast.error("Failed to load data");
      }
    };
    fetchData();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.includes(search))
  ).slice(0, 5); // Show top 5 matches

  const addToCart = (product: any) => {
    if (product.quantity <= 0) {
      toast.error("Product out of stock");
      return;
    }
    
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        toast.error("Cannot exceed available stock");
        return;
      }
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.salePrice }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        batchNumber: product.batchNumber,
        expiryDate: product.expiryDate,
        salePrice: product.salePrice,
        quantity: 1,
        total: product.salePrice
      }]);
    }
    setSearch('');
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) return;
    const product = products.find(p => p.id === productId);
    if (product && newQty > product.quantity) {
      toast.error("Cannot exceed available stock");
      return;
    }
    setCart(cart.map(item => 
      item.productId === productId 
        ? { ...item, quantity: newQty, total: newQty * item.salePrice }
        : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const finalAmount = subtotal - discount + taxAmount;
  const balance = finalAmount - (amountPaid === '' ? 0 : amountPaid);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerName = selectedCustomer?.name || 'Walk-in Customer';

  const handleCheckout = async (printType: 'thermal' | 'a4') => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setLoading(true);
    try {
      const customer = customers.find(c => c.id === customerId);
      const saleData: any = {
        customerName: customer?.name || 'Walk-in Customer',
        totalAmount: subtotal,
        discount,
        tax: taxAmount,
        finalAmount,
        amountPaid: amountPaid === '' ? 0 : amountPaid,
        paymentStatus: balance > 0 ? 'Partial' : 'Paid',
        items: cart,
        date: new Date().toISOString(),
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      };
      
      if (customer?.id) {
        saleData.customerId = customer.id;
        if (balance > 0) {
          const customerRef = doc(db, 'customers', customer.id);
          batch.update(customerRef, {
            loanAmount: (customer.loanAmount || 0) + balance
          });
        }
      }

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, saleData);

      // Update stock and logs
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentQty = productSnap.data().quantity;
          batch.update(productRef, { 
            quantity: currentQty - item.quantity,
            updatedAt: new Date().toISOString()
          });

          const logRef = doc(collection(db, 'stockLogs'));
          batch.set(logRef, {
            productId: item.productId,
            productName: item.productName,
            type: 'OUT',
            quantity: item.quantity,
            referenceId: saleRef.id,
            date: new Date().toISOString()
          });
        }
      }

      await batch.commit();
      toast.success("Sale completed successfully");
      
      // Trigger print
      if (printType === 'thermal') {
        handlePrintThermal();
      } else {
        handlePrintA4();
      }
      
      // Reset after a short delay to allow print capture
      setTimeout(async () => {
        setCart([]);
        setCustomerId('');
        setDiscount(0);
        setAmountPaid('');
        setSearch('');
        
        // Refresh products to get updated stock
        const productsSnap = await getDocs(collection(db, 'products'));
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, 500);

    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintThermal = useReactToPrint({ contentRef: thermalReceiptRef });
  const handlePrintA4 = useReactToPrint({ contentRef: a4ReceiptRef });

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Panel: Products & Search */}
      <div className="flex-1 flex flex-col bg-white p-4 rounded-md border shadow-sm">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Search by product name or barcode..." 
            className="pl-10 text-lg py-6"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        
        {search && (
          <div className="flex-1 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id} className="cursor-pointer hover:bg-gray-50" onClick={() => addToCart(product)}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-gray-500">Batch: {product.batchNumber} | Exp: {product.expiryDate}</div>
                    </TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell>${product.salePrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="secondary">Add</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className="w-[400px] flex flex-col bg-white p-4 rounded-md border shadow-sm">
        <div className="mb-4">
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Walk-in Customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">Walk-in Customer</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-b py-2 mb-4">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">Cart is empty</div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-gray-500">${item.salePrice.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input 
                      type="number" 
                      className="w-16 h-8 text-center" 
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value))}
                    />
                    <div className="font-medium w-16 text-right">${item.total.toFixed(2)}</div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeFromCart(item.productId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Discount</span>
            <Input 
              type="number" 
              className="w-24 h-8 text-right" 
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Tax ({taxRate}%)</span>
            <span className="font-medium">${taxAmount.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-blue-600">${finalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-600">Amount Paid</span>
            <Input 
              type="number" 
              className="w-24 h-8 text-right border-green-300 focus-visible:ring-green-500" 
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>
          {balance > 0 && (
            <div className="flex justify-between items-center text-red-600 text-sm">
              <span>Balance (Loan)</span>
              <span className="font-medium">${balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        <Button 
          className="w-full h-12 text-lg" 
          onClick={() => handleCheckout('thermal')} 
          disabled={cart.length === 0 || loading}
        >
          <Printer className="w-4 h-4 mr-2" />
          {loading ? 'Processing...' : 'Thermal Receipt'}
        </Button>
        <Button 
          className="w-full h-12 text-lg mt-2" 
          variant="secondary"
          onClick={() => handleCheckout('a4')} 
          disabled={cart.length === 0 || loading}
        >
          <Printer className="w-4 h-4 mr-2" />
          {loading ? 'Processing...' : 'A4 Invoice'}
        </Button>
      </div>

      {/* Hidden Receipts for Printing */}
      <div className="hidden">
        {/* Thermal Receipt */}
        <div ref={thermalReceiptRef} className="p-4 w-[80mm] text-sm font-mono bg-white text-black">
          <div className="text-center mb-4">
            <h2 className="font-bold text-xl">PharmaCare</h2>
            <p>123 Health Street, City</p>
            <p>Tel: +1 234 567 890</p>
            <p>{new Date().toLocaleString()}</p>
          </div>
          <div className="mb-2 border-b border-dashed pb-2">
            <p>Customer: {customerName}</p>
            {selectedCustomer?.phone && <p>Tel: {selectedCustomer.phone}</p>}
          </div>
          <div className="border-b border-dashed py-2 mb-2">
            <div className="flex justify-between font-bold">
              <span>Item</span>
              <span>Total</span>
            </div>
          </div>
          {cart.map((item, i) => (
            <div key={i} className="mb-2">
              <div>{item.productName}</div>
              <div className="flex justify-between text-xs">
                <span>{item.quantity} x ${item.salePrice.toFixed(2)}</span>
                <span>${item.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-dashed pt-2 mt-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>${discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>Total:</span>
              <span>${finalAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-center mt-6">
            <p>Thank you for your visit!</p>
            <p>Get well soon.</p>
          </div>
        </div>

        {/* A4 Invoice */}
        <div ref={a4ReceiptRef} className="p-10 w-[210mm] min-h-[297mm] bg-white text-black">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">PharmaCare</h1>
              <p className="text-gray-600">123 Health Street, City</p>
              <p className="text-gray-600">Tel: +1 234 567 890</p>
              <p className="text-gray-600">Email: contact@pharmacare.com</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h2>
              <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
              <p className="text-gray-600">Time: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold border-b pb-2 mb-2">Bill To:</h3>
            <p className="font-bold text-xl text-gray-800">{customerName}</p>
            {selectedCustomer?.phone && <p className="text-gray-600 mt-1">Phone: {selectedCustomer.phone}</p>}
            {selectedCustomer?.address && <p className="text-gray-600 mt-1">Address: {selectedCustomer.address}</p>}
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
              {cart.map((item, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-800">{item.productName}</div>
                    <div className="text-sm text-gray-500">Batch: {item.batchNumber}</div>
                  </td>
                  <td className="text-center py-3 px-4">{item.quantity}</td>
                  <td className="text-right py-3 px-4">${item.salePrice.toFixed(2)}</td>
                  <td className="text-right py-3 px-4 font-medium">${item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-medium">-${discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax ({taxRate}%):</span>
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold border-t-2 border-gray-800 pt-3 mt-3">
                <span>Total:</span>
                <span className="text-blue-600">${finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-gray-200 text-center text-gray-500">
            <p className="font-medium text-gray-600 mb-1">Thank you for your business!</p>
            <p className="text-sm">If you have any questions about this invoice, please contact us.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
