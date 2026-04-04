import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck, 
  ShoppingCart, 
  Receipt, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

export default function MainLayout({ user }: { user: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'POS', href: '/pos', icon: ShoppingCart },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Sales', href: '/sales', icon: Receipt },
    { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Vendors', href: '/vendors', icon: Truck },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
              isActive
                ? 'bg-blue-100 text-blue-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon
              className={`mr-3 flex-shrink-0 h-5 w-5 ${
                isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
              }`}
            />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="text-xl font-bold text-blue-600">PharmaCare</span>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              <NavLinks />
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center w-full">
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700 truncate">{user.displayName || user.email}</p>
                <p className="text-xs font-medium text-gray-500">{user.role}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5 text-gray-500" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header & Content */}
      <div className="flex flex-col flex-1 md:pl-64">
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <span className="text-xl font-bold text-blue-600">PharmaCare</span>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                <Menu className="h-6 w-6" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="h-full flex flex-col bg-white">
                  <div className="flex-1 pt-5 pb-4 overflow-y-auto">
                    <div className="flex items-center flex-shrink-0 px-4 mb-5">
                      <span className="text-xl font-bold text-blue-600">PharmaCare</span>
                    </div>
                    <nav className="px-2 space-y-1">
                      <NavLinks />
                    </nav>
                  </div>
                  <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                    <div className="flex items-center w-full">
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-700 truncate">{user.displayName || user.email}</p>
                        <p className="text-xs font-medium text-gray-500">{user.role}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="h-5 w-5 text-gray-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
