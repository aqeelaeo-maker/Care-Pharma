import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [domainError, setDomainError] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setDomainError(false);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create new user with default 'Staff' role
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'Unknown',
          email: user.email,
          role: 'Staff',
          createdAt: new Date().toISOString()
        });
      }

      toast.success('Logged in successfully');
      navigate('/');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain' || error.message.includes('auth/unauthorized-domain')) {
        setDomainError(true);
      } else {
        toast.error(error.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-blue-600">PharmaCare</CardTitle>
          <CardDescription>
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {domainError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 space-y-2 text-left">
              <div className="flex items-center font-bold text-red-900 mb-2">
                <AlertCircle className="w-5 h-5 mr-2" />
                Action Required in Firebase
              </div>
              <p>Firebase is blocking the login because this AI Studio URL is not authorized in your personal Firebase project.</p>
              <p className="font-semibold mt-2">How to fix this right now:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline text-blue-600">Firebase Console</a>.</li>
                <li>Open your <b>pharmacare-d8ece</b> project.</li>
                <li>Click <b>Authentication</b> &gt; <b>Settings</b> tab &gt; <b>Authorized domains</b>.</li>
                <li>Click <b>Add domain</b> and paste exactly: <br/><code className="bg-red-100 px-1 py-0.5 rounded select-all break-all">ais-dev-ks2tr6pafcbpwqurtuahjs-178560441250.asia-east1.run.app</code></li>
                <li>Click <b>Add domain</b> again and paste: <br/><code className="bg-red-100 px-1 py-0.5 rounded select-all break-all">ais-pre-ks2tr6pafcbpwqurtuahjs-178560441250.asia-east1.run.app</code></li>
                <li>Wait 1-2 minutes, then try logging in again.</li>
              </ol>
            </div>
          )}
          <Button 
            className="w-full" 
            onClick={handleGoogleLogin} 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
