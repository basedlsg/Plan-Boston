import React from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TopNav = () => {
  const { user, logout } = useAuth();

  // Generate avatar fallback from user's name
  const getAvatarFallback = (name: string) => {
    if (!name) return 'U';
    return name.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 container mx-auto justify-between">
        <div className="flex items-center gap-2">
          {/* Left side empty - removed London Day Planner text */}
        </div>
        
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatar_url || ''} alt={user.name || 'User'} />
                  <AvatarFallback>{getAvatarFallback(user.name || '')}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/profile'}>
                My Itineraries
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/'}>
                Create New Plan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/login';
              }}
              className="bg-[#17B9E6] hover:bg-[#15a8d1] text-white py-2 px-4 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
              Sign in with Google
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopNav;