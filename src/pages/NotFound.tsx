import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, SearchX } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-xl border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-xl">
        <CardContent className="p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-accent/15 flex items-center justify-center">
            <SearchX className="h-7 w-7 text-accent" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-accent">Error 404</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Page Not Found</h1>
            <p className="text-sm text-muted-foreground">
              We couldn’t find <span className="font-medium text-foreground">{location.pathname}</span>. The page may have been moved or removed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                <Home className="mr-2 h-4 w-4" /> Go Home
              </Button>
            </Link>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
