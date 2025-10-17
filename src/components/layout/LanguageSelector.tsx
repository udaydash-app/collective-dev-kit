import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const languages = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "ar", name: "العربية" },
];

export function LanguageSelector() {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUserLanguage();
    detectLocationAndCurrency();
  }, []);

  const loadUserLanguage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single();
      
      if (profile?.language) {
        setSelectedLanguage(profile.language);
      }
    } else {
      // Load from localStorage for non-authenticated users
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage) {
        setSelectedLanguage(savedLanguage);
      }
    }
  };

  const detectLocationAndCurrency = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('region, currency')
      .eq('id', user.id)
      .single();

    // Only detect if not already set
    if (profile && (!profile.region || !profile.currency)) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
              // Use reverse geocoding to get country
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );
              const data = await response.json();
              
              const country = data.address?.country || '';
              const countryCode = data.address?.country_code?.toUpperCase() || '';
              
              // Map country to currency
              const currencyMap: Record<string, string> = {
                'CI': 'XOF', // Côte d'Ivoire
                'US': 'USD',
                'FR': 'EUR',
                'GB': 'GBP',
                'NG': 'NGN',
                'GH': 'GHS',
                'KE': 'KES',
              };
              
              const currency = currencyMap[countryCode] || 'USD';
              
              // Update profile with detected location
              await supabase
                .from('profiles')
                .update({
                  region: country,
                  currency: currency,
                })
                .eq('id', user.id);
                
            } catch (error) {
              console.error('Error detecting location:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          }
        );
      }
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    setIsLoading(true);
    setSelectedLanguage(languageCode);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ language: languageCode })
        .eq('id', user.id);
      
      if (error) {
        toast.error("Failed to update language");
        console.error('Error updating language:', error);
      } else {
        toast.success("Language updated");
      }
    } else {
      // Save to localStorage for non-authenticated users
      localStorage.setItem('language', languageCode);
      toast.success("Language updated");
    }
    
    setIsLoading(false);
  };

  const currentLanguage = languages.find(lang => lang.code === selectedLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isLoading} className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background z-50">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={selectedLanguage === language.code ? "bg-accent" : ""}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
