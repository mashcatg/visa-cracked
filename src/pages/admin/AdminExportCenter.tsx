import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, Shield, Globe, Stamp, FileText, Gift, BarChart3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const tables = [
  { name: "profiles" as const, label: "Profiles", icon: Users, description: "User profiles and credits" },
  { name: "user_roles" as const, label: "User Roles", icon: Shield, description: "Role assignments" },
  { name: "countries" as const, label: "Countries", icon: Globe, description: "Supported countries" },
  { name: "visa_types" as const, label: "Visa Types", icon: Stamp, description: "Visa categories and Vapi config" },
  { name: "interviews" as const, label: "Interviews", icon: FileText, description: "All mock interviews" },
  { name: "interview_reports" as const, label: "Interview Reports", icon: BarChart3, description: "AI-generated reports" },
  { name: "credit_grants" as const, label: "Credit Grants", icon: Gift, description: "Admin credit grants" },
];

async function fetchAllRows(tableName: string) {
  let allRows: any[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName as any)
      .select("*")
      .range(from, from + batchSize - 1);
    if (error) throw error;
    allRows = [...allRows, ...(data || [])];
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }
  return allRows;
}

function downloadJSON(data: any[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminExportCenter() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (tableName: string) => {
    setLoading(tableName);
    try {
      const rows = await fetchAllRows(tableName);
      downloadJSON(rows, tableName);
      toast({ title: "Exported", description: `${rows.length} rows from ${tableName}` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Export Center</h2>
        <p className="text-sm text-muted-foreground">Download entire database tables as JSON files</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <Card key={t.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <t.icon className="h-5 w-5 text-accent" />
                <div>
                  <CardTitle className="text-base">{t.label}</CardTitle>
                  <CardDescription className="text-xs">{t.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                disabled={loading === t.name}
                onClick={() => handleExport(t.name)}
              >
                {loading === t.name ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {loading === t.name ? "Exporting..." : "Download JSON"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
