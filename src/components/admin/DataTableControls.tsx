import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  placeholder?: string;
  onExportCSV?: () => void;
  filterSlot?: ReactNode;
}

export default function DataTableControls({ search, onSearchChange, page, totalPages, onPageChange, placeholder = "Search...", onExportCSV, filterSlot }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {filterSlot}
      </div>
      <div className="flex items-center gap-2">
        {onExportCSV && (
          <Button variant="outline" size="sm" onClick={onExportCSV} className="gap-1">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground min-w-[80px] text-center">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
