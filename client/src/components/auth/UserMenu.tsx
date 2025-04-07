import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCircle, LogOut } from 'lucide-react';
import AuthModal from './AuthModal';

const UserMenu: React.FC = () => {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Don't show anything while loading
  if (isLoading) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200"></div>;
  }

  // If user is not authenticated, show login/register button
  if (!isAuthenticated) {
    return (
      <AuthModal
        trigger={
          <Button variant="outline" className="rounded-full" size="sm">
            Sign In
          </Button>
        }
      />
    );
  }

  // If user is authenticated, show user menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative rounded-full h-10 w-10 p-0">
          <UserCircle className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <span className="font-medium">{user?.email}</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>Saved Itineraries</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;