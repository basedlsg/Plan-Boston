import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuthModalProps {
  trigger: React.ReactNode;
}

const AuthModal: React.FC<AuthModalProps> = ({ trigger }) => {
  const { login, register, error, clearError } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  
  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  // Handle login submission
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginSubmitting(true);
    
    try {
      await login(loginEmail, loginPassword);
      setIsOpen(false);
      // Reset form
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handle register submission
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegisterSubmitting(true);
    
    try {
      await register(registerEmail, registerPassword, confirmPassword, name);
      setIsOpen(false);
      // Reset form
      setRegisterEmail('');
      setRegisterPassword('');
      setConfirmPassword('');
      setName('');
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // Handle closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      clearError();
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-semibold">
            Account Access
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign in to save and manage your itineraries
          </DialogDescription>
        </DialogHeader>
        
        <Tabs 
          defaultValue={activeTab} 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value as 'login' | 'register');
            clearError();
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          
          {/* Error alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Login Form */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input 
                  id="login-email" 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required 
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input 
                  id="login-password" 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required 
                  placeholder="Enter your password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginSubmitting}
              >
                {loginSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>
          
          {/* Register Form */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">Name (Optional)</Label>
                <Input 
                  id="register-name" 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input 
                  id="register-email" 
                  type="email" 
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required 
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input 
                  id="register-password" 
                  type="password" 
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required 
                  placeholder="Create a password (min. 8 characters)"
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                  placeholder="Confirm your password"
                  minLength={8}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={registerSubmitting}
              >
                {registerSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;