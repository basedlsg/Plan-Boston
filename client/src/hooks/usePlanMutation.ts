import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PlanFormData {
  date: string;
  time: string;
  plans: string;
}

export function usePlanMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: PlanFormData) => {
      // Map to API expected format if needed
      const apiData = {
        date: data.date,
        startTime: data.time,
        query: data.plans
      };
      
      const response = await apiRequest('POST', '/api/plan', apiData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: 'Your itinerary has been created.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create your itinerary. Please try again.',
        variant: 'destructive',
      });
    }
  });
}