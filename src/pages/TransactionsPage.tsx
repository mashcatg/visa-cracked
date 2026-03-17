import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  created_at: string;
  tran_id: string;
  plan_name: string;
  amount: number;
  credits: number;
  currency: string;
  status: string;
};

const PAGE_SIZE = 10;

export default function TransactionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [currencyFilter, setCurrencyFilter] = useState<"all" | "BDT" | "USD">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    supabase
      .from("orders")
      .select("id, created_at, tran_id, plan_name, amount, credits, currency, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load transactions");
          setLoading(false);
          return;
        }
        setOrders((data || []) as OrderRow[]);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesCurrency = currencyFilter === "all" || order.currency === currencyFilter;
      const matchesSearch =
        !q ||
        order.tran_id.toLowerCase().includes(q) ||
        order.plan_name.toLowerCase().includes(q) ||
        order.status.toLowerCase().includes(q) ||
        order.currency.toLowerCase().includes(q) ||
        String(order.amount).includes(q);
      return matchesStatus && matchesCurrency && matchesSearch;
    });
  }, [orders, search, statusFilter, currencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, currencyFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function downloadInvoice(order: OrderRow) {
    const lines = [
      "=== VISA CRACKED - INVOICE ===",
      "",
      `Transaction ID: ${order.tran_id}`,
      `Date: ${new Date(order.created_at).toLocaleDateString()}`,
      `Plan: ${order.plan_name}`,
      `Credits: ${order.credits}`,
      `Amount: ${order.currency === "USD" ? "$" : "৳"}${order.amount}`,
      `Currency: ${order.currency}`,
      `Status: ${order.status.toUpperCase()}`,
      "",
      "Thank you for your purchase!",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${order.tran_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Your Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Search, filter, and download invoices.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Find specific payments quickly</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-accent bg-muted/30"
                placeholder="Search by transaction ID, plan, status, amount..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="border-0 shadow-none focus:ring-1 focus:ring-accent bg-muted/30">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={(v: any) => setCurrencyFilter(v)}>
              <SelectTrigger className="border-0 shadow-none focus:ring-1 focus:ring-accent bg-muted/30">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="BDT">BDT</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : paged.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No transactions found.</p>
            ) : (
              <div className="space-y-3">
                {paged.map((order) => (
                  <div key={order.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-semibold">{order.plan_name} Plan</p>
                      <p className="text-xs text-muted-foreground">{order.tran_id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{order.currency === "USD" ? "$" : "৳"}{order.amount}</p>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${order.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : order.status === "pending" ? "bg-yellow-500/10 text-yellow-600" : "bg-destructive/10 text-destructive"}`}>
                          {order.status}
                        </span>
                      </div>
                      {order.status === "paid" && (
                        <Button size="icon" variant="ghost" onClick={() => downloadInvoice(order)} title="Download Invoice">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
