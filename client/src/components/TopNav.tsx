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
          <Link href="/">
            <a className="flex items-center gap-2">
              <span className="font-bold text-xl">London Day Planner</span>
            </a>
          </Link>
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
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <a className="w-full cursor-pointer">Profile</a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/">
                  <a className="w-full cursor-pointer">Planner</a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/login">
              <a className="text-sm font-medium">Log in</a>
            </Link>
            <Link href="/register">
              <a className="text-sm font-medium bg-primary text-primary-foreground py-1 px-3 rounded-md">Sign up</a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopNav;