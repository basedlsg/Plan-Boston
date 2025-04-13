import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';

interface ItineraryHistoryItem {
  id: number;
  title: string;
  created_at: string;
  query?: string;
}

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Query to fetch user's itinerary history
  const { data: itineraries, isLoading, error } = useQuery<ItineraryHistoryItem[]>({
    queryKey: ['/api/itineraries/user'],
    enabled: !!user,
  });

  // Format date to a more readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    }
  };

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
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-col items-center pb-2">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={user?.avatar_url || ''} alt={user?.name || 'User'} />
              <AvatarFallback className="text-xl">{getAvatarFallback(user?.name || '')}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-center text-2xl">{user?.name || 'User'}</CardTitle>
            <CardDescription className="text-center">{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline" onClick={handleLogout}>
              Log Out
            </Button>
            <Link href="/">
              <Button className="w-full">Return to Planner</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Itinerary History Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Generation History</CardTitle>
            <CardDescription>
              View your previously generated travel itineraries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              // Skeleton loading state
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Separator className="my-2" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-muted-foreground">
                Failed to load itinerary history. Please try again later.
              </div>
            ) : itineraries && Array.isArray(itineraries) && itineraries.length > 0 ? (
              <div className="space-y-4">
                {itineraries.map((itinerary) => (
                  <div key={itinerary.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{itinerary.title || 'London Itinerary'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(itinerary.created_at)}
                        </p>
                        {itinerary.query && (
                          <p className="text-sm mt-1 italic">"{itinerary.query}"</p>
                        )}
                      </div>
                      <Link href={`/itinerary/${itinerary.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                    <Separator className="my-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No itineraries generated yet. Start planning your perfect day in London!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;