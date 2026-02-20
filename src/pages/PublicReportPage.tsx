import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Target, MessageSquare, Award, TrendingUp, Shield, Mic2, BookOpen, Brain, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PublicReportPage() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetch() {
      const { data } = await supabase
        .from("interviews")
        .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
        .eq("id", id)
        .eq("is_public", true)
        .single();

      if (data) {
        setInterview(data);
        setReport(data.interview_reports);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }
    fetch();
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  if (notFound || !interview) return <div className="flex h-screen items-center justify-center"><p className="text-muted-foreground">Report not found or not public.</p></div>;

  const overallScore = report?.overall_score ?? 0;
  const scoreColor = (s: number) => s >= 80 ? "text-emerald-600" : s >= 60 ? "text-amber-500" : "text-red-500";
  const categories = [
    { label: "English", score: report?.english_score, icon: MessageSquare, color: "text-blue-500" },
    { label: "Confidence", score: report?.confidence_score, icon: Award, color: "text-purple-500" },
    { label: "Financial", score: report?.financial_clarity_score, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Intent", score: report?.immigration_intent_score, icon: Shield, color: "text-amber-500" },
    { label: "Pronunciation", score: report?.pronunciation_score, icon: Mic2, color: "text-pink-500" },
    { label: "Vocabulary", score: report?.vocabulary_score, icon: BookOpen, color: "text-cyan-500" },
    { label: "Relevance", score: report?.response_relevance_score, icon: Brain, color: "text-indigo-500" },
  ];

  const grammarMistakes: any[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Visa Cracked — Shared Report</p>
          <h1 className="text-2xl font-bold">{interview.name || "Mock Test Report"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {(interview.countries as any)?.flag_emoji} {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name}
          </p>
        </div>

        {report && (
          <>
            <div className="flex justify-center mb-6">
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground inline-block">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="relative">
                    <svg className="w-20 h-20" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="opacity-20" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${overallScore * 3.27} 327`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{overallScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">Overall Score</p>
                    <p className="text-xs text-primary-foreground/60">{overallScore >= 80 ? "Excellent" : overallScore >= 60 ? "Good" : "Needs Work"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Card key={cat.label}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                    </div>
                    <div className={`text-2xl font-bold mb-1.5 ${scoreColor(cat.score ?? 0)}`}>{cat.score ?? "—"}</div>
                    <Progress value={cat.score ?? 0} className="h-1" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {report.summary && (
              <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p></CardContent></Card>
            )}

            {redFlags.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Red Flags</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {redFlags.map((f, i) => <p key={i} className="text-sm flex items-start gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />{f}</p>)}
                </CardContent>
              </Card>
            )}

            {grammarMistakes.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /> Grammar ({grammarMistakes.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {grammarMistakes.map((m: any, i: number) => (
                    <div key={i} className="text-sm">
                      <span className="text-red-500 line-through">{m.original}</span> → <span className="text-emerald-600 font-medium">{m.corrected}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {improvementPlan.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /> Improvement Plan</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {improvementPlan.map((item, i) => <p key={i} className="text-sm">{i + 1}. {item}</p>)}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">Powered by Visa Cracked — AI Mock Interview Platform</p>
      </div>
    </div>
  );
}
