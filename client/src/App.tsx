import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import VenueSwiperTest from "@/components/VenueSwiperTest";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/venue-swiper-test" component={VenueSwiperTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="fixed top-4 right-4">
          <ThemeToggle />
        </div>
        <Router />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;