import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function AdminInterviews() {
  const [interviews, setInterviews] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("interviews")
      .select("*, countries(name), visa_types(name), interview_reports(overall_score), profiles!interviews_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setInterviews(data);
      });
  }, []);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Visa Type</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {interviews.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{(i.profiles as any)?.full_name || "—"}</TableCell>
              <TableCell>{(i.countries as any)?.name}</TableCell>
              <TableCell>{(i.visa_types as any)?.name}</TableCell>
              <TableCell>
                {i.interview_reports?.overall_score != null ? (
                  <span className={
                    i.interview_reports.overall_score >= 80 ? "text-green-600 font-bold" :
                    i.interview_reports.overall_score >= 60 ? "text-yellow-600 font-bold" : "text-red-600 font-bold"
                  }>
                    {i.interview_reports.overall_score}/100
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell><span className="capitalize">{i.status}</span></TableCell>
              <TableCell>{new Date(i.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Link to={`/interview/${i.id}/report`}>
                  <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {interviews.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No interviews</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
