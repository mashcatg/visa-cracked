import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;

interface Order {
  id: string;
  user_id: string;
  tran_id: string;
  plan_name: string;
  amount: number;
  credits: number;
  currency: string;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

function downloadInvoice(order: Order) {
  const lines = [
    "=== VISA CRACKED - INVOICE ===",
    "",
    `Transaction ID: ${order.tran_id}`,
    `Date: ${new Date(order.created_at).toLocaleDateString()}`,
    `Customer: ${order.profiles?.full_name || "N/A"}`,
    `Email: ${order.profiles?.email || "N/A"}`,
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

export default function AdminTransactions() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*, profiles!orders_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as any);
  }

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.tran_id.toLowerCase().includes(q) ||
      o.plan_name.toLowerCase().includes(q) ||
      (o.profiles?.full_name || "").toLowerCase().includes(q) ||
      (o.profiles?.email || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  function handleExport() {
    const cols: CsvColumn[] = [
      { key: "tran_id", label: "Transaction ID" },
      { key: "user", label: "User", accessor: (o) => o.profiles?.full_name || "" },
      { key: "email", label: "Email", accessor: (o) => o.profiles?.email || "" },
      { key: "plan_name", label: "Plan" },
      { key: "amount", label: "Amount", accessor: (o) => String(o.amount) },
      { key: "currency", label: "Currency" },
      { key: "credits", label: "Credits", accessor: (o) => String(o.credits) },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Date", accessor: (o) => new Date(o.created_at).toLocaleDateString() },
    ];
    downloadCSV(filtered, cols, "transactions");
  }

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "pending") return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <DataTableControls
          search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
          placeholder="Search by name, email, or transaction ID..."
        />
        <Button variant="outline" onClick={handleExport} className="gap-1.5">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{o.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{o.profiles?.email || "—"}</p>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{o.plan_name}</TableCell>
                <TableCell>{o.currency === "USD" ? "$" : "৳"}{o.amount}</TableCell>
                <TableCell>{o.credits}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(o.status) as any} className="capitalize">{o.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {o.status === "paid" && (
                    <Button size="sm" variant="ghost" onClick={() => downloadInvoice(o)} className="gap-1">
                      <Download className="h-3.5 w-3.5" /> Invoice
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transactions found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
