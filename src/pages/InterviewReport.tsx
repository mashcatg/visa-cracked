import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Loader2, TrendingUp, Shield, MessageSquare, Award } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

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
        .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
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

      const blob = new Blob([Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mock-report-${id}.pdf`;
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
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Mock test not found</p>
      </div>
    );
  }

  const overallScore = report?.overall_score ?? 0;

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";

  const scoreBgClass = (score: number) =>
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  const scoreLabel = (score: number) =>
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work";

  const grammarMistakes: GrammarMistake[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

  const categories = [
    { label: "English Proficiency", score: report?.english_score, icon: MessageSquare, color: "text-blue-500" },
    { label: "Confidence Level", score: report?.confidence_score, icon: Award, color: "text-purple-500" },
    { label: "Financial Clarity", score: report?.financial_clarity_score, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Immigration Intent", score: report?.immigration_intent_score, icon: Shield, color: "text-amber-500" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {interview.name || "Mock Test Report"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {(interview.countries as any)?.flag_emoji} {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name} •{" "}
            {new Date(interview.created_at).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={downloadPdf} disabled={downloading} variant="outline" className="gap-2 shrink-0">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </Button>
      </div>

      {!report ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-accent" />
          <p className="font-medium">Analyzing your mock test...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
        </Card>
      ) : (
        <>
          {/* Overall Score Hero */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 sm:p-8 text-primary-foreground">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-primary-foreground/20 flex items-center justify-center bg-primary-foreground/10 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="text-4xl sm:text-5xl font-bold">{overallScore}</div>
                      <div className="text-xs text-primary-foreground/60">/ 100</div>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                    <Target className="h-5 w-5" />
                    <span className="text-lg font-semibold">Overall Performance</span>
                  </div>
                  <p className="text-primary-foreground/70 text-sm">
                    {overallScore >= 80
                      ? "Great job! You're well-prepared for your visa interview."
                      : overallScore >= 60
                      ? "Good progress! A few areas to improve before your interview."
                      : "Keep practicing! Focus on the improvement areas below."}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Category Scores */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => (
              <Card key={cat.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <cat.icon className={`h-4 w-4 ${cat.color}`} />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{cat.label}</span>
                  </div>
                  <div className={`text-2xl sm:text-3xl font-bold mb-2 ${scoreColor(cat.score ?? 0)}`}>
                    {cat.score ?? 0}
                  </div>
                  <Progress value={cat.score ?? 0} className="h-1.5" />
                  <p className={`text-xs mt-1.5 font-medium ${scoreColor(cat.score ?? 0)}`}>
                    {scoreLabel(cat.score ?? 0)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          {report.summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Grammar Mistakes */}
          {grammarMistakes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="h-5 w-5 text-red-500" /> Grammar Mistakes
                  <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{grammarMistakes.length} found</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {grammarMistakes.map((m, i) => (
                  <div key={i} className="rounded-lg bg-red-50 p-3 sm:p-4 border border-red-100">
                    <p className="text-sm text-red-700 line-through">{m.original}</p>
                    <p className="text-sm text-emerald-700 font-medium mt-1">✓ {m.corrected}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> Red Flags
                  <span className="ml-auto text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">{redFlags.length} detected</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {redFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 sm:p-4 border border-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800">{flag}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Improvement Plan */}
          {improvementPlan.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-500" /> Improvement Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {improvementPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 sm:p-4 border border-emerald-100">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                    </div>
                    <p className="text-sm text-emerald-800">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recording */}
          {interview.recording_url && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-lg bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {interview.transcript}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
