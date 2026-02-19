import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GrammarMistake {
  original: string;
  corrected: string;
}

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      const { data: interviewData } = await supabase
        .from("interviews")
        .select("*, countries(name), visa_types(name), interview_reports(*)")
        .eq("id", id)
        .single();

      if (interviewData) {
        setInterview(interviewData);
        setReport(interviewData.interview_reports);
      }
      setLoading(false);
    }

    fetchData();
  }, [id]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report-pdf", {
        body: { interviewId: id },
      });
      if (error) throw error;

      // Download the PDF
      const blob = new Blob([Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-report-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to generate PDF");
    }
    setDownloading(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Interview not found</p>
      </div>
    );
  }

  const scoreColor = (score: number) =>
    score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";

  const scoreBarColor = (score: number) =>
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  const grammarMistakes: GrammarMistake[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Report</h1>
          <p className="text-muted-foreground mt-1">
            {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name} •{" "}
            {new Date(interview.created_at).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={downloadPdf} disabled={downloading} variant="outline" className="gap-2">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </Button>
      </div>

      {!report ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="font-medium">Analyzing your interview...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
        </Card>
      ) : (
        <>
          {/* Overall Score */}
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className={`text-6xl font-bold ${scoreColor(report.overall_score ?? 0)}`}>
                    {report.overall_score ?? 0}
                  </div>
                  <p className="text-muted-foreground text-lg mt-1">/ 100</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Scores */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "English", score: report.english_score },
              { label: "Confidence", score: report.confidence_score },
              { label: "Financial Clarity", score: report.financial_clarity_score },
              { label: "Immigration Intent", score: report.immigration_intent_score },
            ].map((cat) => (
              <Card key={cat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{cat.label}</span>
                    <span className={`text-lg font-bold ${scoreColor(cat.score ?? 0)}`}>{cat.score ?? 0}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBarColor(cat.score ?? 0)}`} style={{ width: `${cat.score ?? 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Grammar Mistakes */}
          {grammarMistakes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" /> Grammar Mistakes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {grammarMistakes.map((m, i) => (
                  <div key={i} className="rounded-lg bg-red-50 p-4 border border-red-100">
                    <p className="text-sm text-red-700 line-through">{m.original}</p>
                    <p className="text-sm text-green-700 font-medium mt-1">✓ {m.corrected}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" /> Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {redFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 border border-yellow-100">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-yellow-800">{flag}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Improvement Plan */}
          {improvementPlan.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" /> Improvement Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {improvementPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-green-50 p-4 border border-green-100">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-800">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Audio Playback */}
          {interview.recording_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <audio controls className="w-full" src={interview.recording_url} />
              </CardContent>
            </Card>
          )}

          {/* Transcript */}
          {interview.transcript && (
            <Card>
              <CardHeader>
                <CardTitle>Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-lg bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {interview.transcript}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {report.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{report.summary}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
