import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

export default function Reports() {
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesSnap, purchasesSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'purchases')),
          getDocs(collection(db, 'products'))
        ]);
        
        setSales(salesSnap.docs.map(doc => doc.data()));
        setPurchases(purchasesSnap.docs.map(doc => doc.data()));
        setProducts(productsSnap.docs.map(doc => doc.data()));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Prepare chart data (last 7 days sales)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  const chartData = last7Days.map(dateStr => {
    const daySales = sales.filter(s => s.date.startsWith(dateStr));
    const total = daySales.reduce((sum, sale) => sum + sale.finalAmount, 0);
    return { name: format(parseISO(dateStr), 'MMM dd'), sales: total };
  });

  const expiredProducts = products.filter(p => new Date(p.expiryDate) < new Date());
  const lowStockProducts = products.filter(p => p.quantity < 10);

  if (loading) return <div>Loading reports...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Alerts</TabsTrigger>
          <TabsTrigger value="profit">Profit/Loss</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Expired Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.batchNumber}</TableCell>
                      <TableCell className="text-red-600 font-medium">{p.expiryDate}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                  {expiredProducts.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center">No expired products</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-yellow-600">Low Stock Products (Below 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-yellow-600 font-medium">{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                  {lowStockProducts.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center">No low stock products</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overall Profit/Loss Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Total Sales Revenue</div>
                  <div className="text-2xl font-bold">${sales.reduce((sum, s) => sum + s.finalAmount, 0).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Total Purchase Cost</div>
                  <div className="text-2xl font-bold">${purchases.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Gross Profit</div>
                  <div className="text-2xl font-bold">
                    ${(sales.reduce((sum, s) => sum + s.finalAmount, 0) - purchases.reduce((sum, p) => sum + p.totalAmount, 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
