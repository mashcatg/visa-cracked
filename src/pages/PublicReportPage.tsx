import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Target, MessageSquare, Award, TrendingUp, Shield, Mic2, BookOpen, Brain, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const scoreLabel = (s: number) => s >= 80 ? "Excellent" : s >= 60 ? "Good" : "Needs Work";

  const categories = [
    { label: "English", score: report?.english_score, icon: MessageSquare },
    { label: "Confidence", score: report?.confidence_score, icon: Award },
    { label: "Financial", score: report?.financial_clarity_score, icon: TrendingUp },
    { label: "Intent", score: report?.immigration_intent_score, icon: Shield },
    { label: "Pronunciation", score: report?.pronunciation_score, icon: Mic2 },
    { label: "Vocabulary", score: report?.vocabulary_score, icon: BookOpen },
    { label: "Relevance", score: report?.response_relevance_score, icon: Brain },
  ];

  const grammarMistakes: any[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

  const rawMessages: any[] = Array.isArray(interview.messages) ? interview.messages : [];
  const chatMessages = rawMessages.filter((m: any) => (m.role === "assistant" || m.role === "user") && m.content);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Visa Cracked — Shared Report</p>
          <h1 className="text-2xl font-bold">{interview.name || "Mock Test Report"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {(interview.countries as any)?.flag_emoji} {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name}
          </p>
        </div>

        {report && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* LEFT: Transcript + Summary */}
            <div className="space-y-6 min-w-0">
              {/* Transcript Chat Bubbles */}
              {(chatMessages.length > 0 || interview.transcript) && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-accent" /> Conversation
                    </p>
                    <ScrollArea className="h-[500px] pr-4">
                      {chatMessages.length > 0 ? (
                        <div className="space-y-4">
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-accent/10 border border-accent/20 rounded-2xl rounded-br-sm"
                                  : "bg-muted rounded-2xl rounded-bl-sm"
                              }`}>
                                <p className={`text-[10px] font-semibold mb-1 ${
                                  msg.role === "user" ? "text-accent" : "text-muted-foreground"
                                }`}>
                                  {msg.role === "user" ? "You" : "Officer"}
                                </p>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {interview.transcript}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* AI Summary */}
              {report.summary && (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div className="space-y-4">
              {/* Overall Score */}
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <svg className="w-24 h-24" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="opacity-20" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${overallScore * 3.27} 327`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{overallScore}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-4 w-4" />
                    <span className="font-semibold text-sm">Overall Score</span>
                  </div>
                  <p className="text-primary-foreground/60 text-xs">{scoreLabel(overallScore)}</p>
                </CardContent>
              </Card>

              {/* Category Scores */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Category Scores</h3>
                  <div className="space-y-3">
                    {categories.map((cat) => (
                      <div key={cat.label} className="flex items-center gap-3">
                        <cat.icon className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-sm text-muted-foreground flex-1">{cat.label}</span>
                        <span className={`text-sm font-bold ${scoreColor(cat.score ?? 0)}`}>{cat.score ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Red Flags */}
              {redFlags.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Red Flags
                    </h3>
                    <div className="space-y-2">
                      {redFlags.map((f, i) => (
                        <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-orange-500 mt-1 shrink-0">•</span>{f}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Grammar */}
              {grammarMistakes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-500" /> Grammar ({grammarMistakes.length})
                    </h3>
                    <div className="space-y-2.5">
                      {grammarMistakes.map((m: any, i: number) => (
                        <div key={i} className="text-sm">
                          <span className="text-red-500 line-through">{m.original}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="text-emerald-600 font-medium">{m.corrected}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Improvement Plan */}
              {improvementPlan.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" /> Improvement Plan
                    </h3>
                    <div className="space-y-2">
                      {improvementPlan.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-accent">{i + 1}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">Powered by Visa Cracked — AI Mock Interview Platform</p>
      </div>
    </div>
  );
}
