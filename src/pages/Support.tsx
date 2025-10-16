import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MessageCircle, ChevronRight } from "lucide-react";

const faqItems = [
  { question: "How do I track my order?", answer: "Track orders in the Orders section" },
  { question: "What are the delivery hours?", answer: "We deliver 8 AM - 10 PM daily" },
  { question: "How do I change my address?", answer: "Update in Profile > Addresses" },
  { question: "What payment methods are accepted?", answer: "Cards, digital wallets, and more" },
];

export default function Support() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Help & Support</h1>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <Phone className="h-8 w-8 text-primary" />
                <span className="font-medium">Phone</span>
                <span className="text-sm text-muted-foreground">(555) 123-4567</span>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <Mail className="h-8 w-8 text-primary" />
                <span className="font-medium">Email</span>
                <span className="text-sm text-muted-foreground">support@globalmarket.com</span>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <MessageCircle className="h-8 w-8 text-primary" />
                <span className="font-medium">Live Chat</span>
                <span className="text-sm text-muted-foreground">9 AM - 6 PM</span>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium mb-1">{item.question}</h3>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
