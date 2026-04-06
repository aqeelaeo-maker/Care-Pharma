import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, AlertTriangle, TrendingUp, Users, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSettings } from '../contexts/SettingsContext';

export default function Dashboard() {
  const settings = useSettings();
  const [stats, setStats] = useState({
    totalProducts: 0,
    salesToday: 0,
    expiredItems: 0,
    nearExpiryItems: 0,
    lowStock: 0,
    totalCustomerLoan: 0,
    totalVendorPending: 0
  });
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showNearExpiry, setShowNearExpiry] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products
        const productsSnap = await getDocs(collection(db, 'products'));
        const productsData: any[] = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
        
        const totalProducts = productsData.length;
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const expiredItems = productsData.filter(p => new Date(p.expiryDate) < today).length;
        const nearExpiryItems = productsData.filter(p => {
          const expDate = new Date(p.expiryDate);
          return expDate >= today && expDate <= thirtyDaysFromNow;
        }).length;
        const lowStock = productsData.filter(p => p.quantity > 0 && p.quantity <= settings.minimumStockLimit).length;

        // Fetch today's sales
        const todayStr = today.toISOString().split('T')[0];
        const salesQuery = query(
          collection(db, 'sales'),
          where('date', '>=', todayStr + 'T00:00:00.000Z'),
          where('date', '<=', todayStr + 'T23:59:59.999Z')
        );
        const salesSnap = await getDocs(salesQuery);
        const salesToday = salesSnap.docs.reduce((acc, doc) => acc + doc.data().finalAmount, 0);

        // Fetch customers loan
        const customersSnap = await getDocs(collection(db, 'customers'));
        const totalCustomerLoan = customersSnap.docs.reduce((acc, doc) => acc + (doc.data().loanAmount || 0), 0);

        // Fetch vendors pending
        const vendorsSnap = await getDocs(collection(db, 'vendors'));
        const totalVendorPending = vendorsSnap.docs.reduce((acc, doc) => acc + (doc.data().pendingPayment || 0), 0);

        setStats({
          totalProducts,
          salesToday,
          expiredItems,
          nearExpiryItems,
          lowStock,
          totalCustomerLoan,
          totalVendorPending
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.currency}{stats.salesToday.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers Loan</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{settings.currency}{stats.totalCustomerLoan.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendors Pending Payment</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{settings.currency}{stats.totalVendorPending.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowLowStock(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowNearExpiry(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Expiry Items (30 Days)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.nearExpiryItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Dialog */}
      <Dialog open={showLowStock} onOpenChange={setShowLowStock}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Low Stock Products (≤ {settings.minimumStockLimit})</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.filter(p => p.quantity > 0 && p.quantity <= settings.minimumStockLimit).map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.batchNumber}</TableCell>
                  <TableCell className="text-red-600 font-bold">{product.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Near Expiry Dialog */}
      <Dialog open={showNearExpiry} onOpenChange={setShowNearExpiry}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Near Expiry Products (Next 30 Days)</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Expiry Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.filter(p => {
                const today = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(today.getDate() + 30);
                const expDate = new Date(p.expiryDate);
                return expDate >= today && expDate <= thirtyDaysFromNow;
              }).map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.batchNumber}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell className="text-orange-600 font-bold">{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
