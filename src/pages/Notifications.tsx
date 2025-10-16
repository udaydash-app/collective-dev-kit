import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Bell } from "lucide-react";

export default function Notifications() {
  const hasNotifications = false;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>

        {!hasNotifications ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No notifications</h2>
              <p className="text-muted-foreground">
                We'll notify you about orders and deals
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Notification items will be listed here */}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
