import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, XCircle, Loader2, TrendingUp, Shield, MessageSquare, Award, Copy, Mic2, BookOpen, Brain, Target, ArrowLeft, XOctagon, Clock, RefreshCw } from "lucide-react";
import CustomAudioPlayer from "@/components/audio/CustomAudioPlayer";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface GrammarMistake {
  original: string;
  corrected: string;
  explanation?: string;
}

interface DetailedFeedback {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  suggested_answer?: string;
}

interface VapiData {
  recordingUrl: string | null;
  stereoRecordingUrl: string | null;
  transcript: string | null;
  messages: Array<{ role: string; content: string; timestamp?: number }>;
  duration: number | null;
  endedReason: string | null;
}

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [vapiData, setVapiData] = useState<VapiData | null>(null);
  const [vapiLoading, setVapiLoading] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const pollStartRef = useRef<number>(0);
  const isMobile = useIsMobile();

  async function fetchVapiData(interviewId: string) {
    setVapiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-vapi-data", {
        body: { interviewId },
      });
      if (!error && data) setVapiData(data as VapiData);
    } catch (e) {
      console.error("Failed to fetch Vapi data:", e);
    }
    setVapiLoading(false);
  }

  useEffect(() => {
    if (!id) return;

    // Reset state when ID changes
    setInterview(null);
    setReport(null);
    setVapiData(null);
    setLoading(true);
    setAnalysisFailed(false);

    let pollInterval: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    async function fetchData() {
      const { data: interviewData } = await supabase
        .from("interviews")
        .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
        .eq("id", id)
        .single();

      if (interviewData && isComponentMounted) {
        setInterview(interviewData);
        if (interviewData.interview_reports) setReport(interviewData.interview_reports);
        if (interviewData.vapi_call_id && interviewData.status === "completed") fetchVapiData(id!);
      }
      setLoading(false);
      return interviewData;
    }

    fetchData().then((data) => {
      if (!isComponentMounted) return;
      
      if (data && data.status !== "failed") {
        pollStartRef.current = Date.now();
        pollInterval = setInterval(async () => {
          const elapsed = Date.now() - pollStartRef.current;
          if (elapsed > 120000) {
            if (pollInterval) clearInterval(pollInterval);
            if (isComponentMounted) {
              setReport((currentReport) => {
                if (!currentReport || (!currentReport.summary && !currentReport.english_score && !currentReport.detailed_feedback)) {
                  setAnalysisFailed(true);
                }
                return currentReport;
              });
            }
            return;
          }
          const { data: freshInterview } = await supabase
            .from("interviews")
            .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
            .eq("id", id)
            .single();
          if (freshInterview && isComponentMounted) {
            setInterview(freshInterview);
            if (!vapiData && freshInterview.vapi_call_id && freshInterview.status === "completed") fetchVapiData(id!);
            if (freshInterview.interview_reports) {
              setReport(freshInterview.interview_reports);
              const r = freshInterview.interview_reports;
              if (r.summary != null && r.english_score != null && Array.isArray(r.grammar_mistakes) && r.grammar_mistakes.length > 0 && Array.isArray(r.detailed_feedback) && r.detailed_feedback.length > 0) {
                if (pollInterval) clearInterval(pollInterval);
              }
            }
          }
        }, 5000);
      }
    });

    // Cleanup function: stop polling when navigating away
    return () => {
      isComponentMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id]);

  async function regenerateReport() {
    setRegenerating(true);
    setAnalysisFailed(false);
    pollStartRef.current = Date.now();
    try {
      await supabase.functions.invoke("analyze-interview", { body: { interviewId: id } });
      const { data: freshInterview } = await supabase
        .from("interviews")
        .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
        .eq("id", id)
        .single();
      if (freshInterview?.interview_reports) {
        setReport(freshInterview.interview_reports);
        setInterview(freshInterview);
      }
    } catch {
      toast.error("Failed to regenerate report");
      setAnalysisFailed(true);
    }
    setRegenerating(false);
  }

  async function downloadReport() {
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
      a.download = data.filename || `mock-report-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to generate report");
    }
    setDownloading(false);
  }

  function copyTranscript() {
    const text = vapiData?.transcript || interview?.transcript;
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success("Transcript copied!");
    }
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded shimmer-block" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded shimmer-block" />
            <div className="h-3 w-32 rounded shimmer-block" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="rounded-xl bg-card p-5 space-y-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 w-full rounded-lg shimmer-block" />)}
            </div>
            <div className="rounded-xl bg-card p-5 space-y-2">
              <div className="h-3 w-full rounded shimmer-block" />
              <div className="h-3 w-4/5 rounded shimmer-block" />
              <div className="h-3 w-3/5 rounded shimmer-block" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-card p-6 flex flex-col items-center">
              <div className="w-28 h-28 rounded-full shimmer-block mb-3" />
              <div className="h-3 w-24 rounded shimmer-block" />
            </div>
            <div className="rounded-xl bg-card p-4 space-y-3">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3.5 w-3.5 rounded shimmer-block" />
                  <div className="h-3 flex-1 rounded shimmer-block" />
                  <div className="h-4 w-8 rounded shimmer-block" />
                </div>
              ))}
            </div>
          </div>
        </div>
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

  if (interview.status === "failed") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md w-full text-center p-8">
          <XOctagon className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Mock Test Failed</h2>
          <p className="text-muted-foreground text-sm mb-6">The call could not be completed. No credits were deducted.</p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";
  const scoreLabel = (score: number) =>
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work";

  const hasSummary = report?.summary != null;
  const hasScores = report?.english_score != null;
  const hasIssues = report && Array.isArray(report.grammar_mistakes) && report.grammar_mistakes.length > 0;
  const hasFeedback = report && Array.isArray(report.detailed_feedback) && report.detailed_feedback.length > 0;

  const overallScore = report?.overall_score ?? 0;
  const grammarMistakes: GrammarMistake[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];
  const detailedFeedback: DetailedFeedback[] = Array.isArray(report?.detailed_feedback) ? report.detailed_feedback : [];

  const categories = [
    { label: "English", score: report?.english_score, icon: MessageSquare },
    { label: "Confidence", score: report?.confidence_score, icon: Award },
    { label: "Financial", score: report?.financial_clarity_score, icon: TrendingUp },
    { label: "Intent", score: report?.immigration_intent_score, icon: Shield },
    { label: "Pronunciation", score: report?.pronunciation_score, icon: Mic2 },
    { label: "Vocabulary", score: report?.vocabulary_score, icon: BookOpen },
    { label: "Relevance", score: report?.response_relevance_score, icon: Brain },
  ];

  const rawMessages: any[] = vapiData?.messages ?? (Array.isArray(interview.messages) ? interview.messages : []);
  const chatMessages = rawMessages.filter((m: any) => {
    const hasRole = m.role === "assistant" || m.role === "user" || m.role === "gpt" || m.role === "bot" || (typeof m.role === "string" && (m.role.toLowerCase().includes("assistant") || m.role.toLowerCase().includes("gpt")));
    const hasContent = m.content || m.message || m.transcript || m.text;
    return hasRole && hasContent;
  });
  const recordingUrl = vapiData?.recordingUrl ?? interview.recording_url;
  const transcript = vapiData?.transcript ?? interview.transcript;
  const duration = vapiData?.duration ?? interview.duration;

  const scoreWidgets = (
    <>
      {/* Overall Score */}
      {hasSummary ? (
        <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="relative mb-3">
              <svg className="w-28 h-28" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="opacity-20" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${overallScore * 3.27} 327`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{overallScore}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-4 w-4" />
              <span className="font-semibold text-sm">Overall Score</span>
            </div>
            <p className="text-primary-foreground/60 text-xs">{scoreLabel(overallScore)}</p>
          </CardContent>
        </Card>
      ) : !analysisFailed ? (
        <Card className="border-0 bg-muted/30">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="w-28 h-28 rounded-full shimmer-block mb-3" />
            <div className="h-3 w-24 rounded shimmer-block mt-2" />
          </CardContent>
        </Card>
      ) : null}

      {/* Category Scores */}
      {hasScores ? (
        <Card className="border-0">
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
      ) : !analysisFailed ? (
        <Card className="border-0">
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3.5 w-3.5 rounded shimmer-block shrink-0" />
                <div className="h-3 w-16 rounded shimmer-block flex-1" />
                <div className="h-4 w-8 rounded shimmer-block" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );


  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {interview.name || "Mock Test Report"}
            </h1>
            <p className="text-muted-foreground text-sm flex flex-wrap items-center gap-x-2">
              <span>{(interview.countries as any)?.flag_emoji} {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name}</span>
              <span>• {new Date(interview.created_at).toLocaleDateString()}</span>
              {duration != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(duration)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={downloadReport} disabled={downloading || !hasSummary} variant="outline" size="sm">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Download
          </Button>
        </div>
      </div>

      {/* Custom Audio Player */}
      {recordingUrl && <CustomAudioPlayer src={recordingUrl} className="w-full" />}
      {vapiLoading && !recordingUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded shimmer-block" />
              <div className="h-10 w-10 rounded-full shimmer-block shrink-0" />
              <div className="h-4 w-4 rounded shimmer-block" />
              <div className="h-3 w-10 rounded shimmer-block" />
              <div className="h-2 flex-1 rounded shimmer-block" />
              <div className="h-3 w-10 rounded shimmer-block" />
              <div className="h-4 w-4 rounded shimmer-block" />
              <div className="h-2 w-16 rounded shimmer-block" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Failed */}
      {analysisFailed && !hasSummary && (
        <Card className="border-0 border-destructive/30">
          <CardContent className="p-6 text-center space-y-3">
            <XOctagon className="h-10 w-10 text-destructive mx-auto" />
            <h3 className="font-semibold">AI Analysis Failed</h3>
            <p className="text-sm text-muted-foreground">The AI couldn't generate your report. Please try again.</p>
            <Button onClick={regenerateReport} disabled={regenerating} className="mt-2">
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Regenerate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {isMobile && (
        <div className="space-y-4">
          {scoreWidgets}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* LEFT COLUMN: Transcript + Summary */}
        <div className="space-y-6 min-w-0">
          {/* Transcript with Chat Bubbles */}
          {(chatMessages.length > 0 || transcript) && (
            <Card className="border-0">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  Conversation Transcript
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={copyTranscript} className="text-xs">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  {chatMessages.length > 0 ? (
                    <div className="space-y-4">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className="flex flex-col gap-1">
                            <div className={`max-w-xs px-4 py-3 text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-accent/15 border border-accent/30 rounded-3xl rounded-tr-lg text-foreground"
                                : "bg-muted border border-border rounded-3xl rounded-tl-lg text-foreground"
                            }`}>
                              {msg.content || msg.message || msg.transcript || msg.text}
                            </div>
                            {msg.timestamp && (
                              <p className={`text-xs text-muted-foreground ${
                                msg.role === "user" ? "text-right pr-4" : "pl-4"
                              }`}>
                                {new Date(msg.timestamp * 1000).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {transcript}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* AI Summary */}
          {hasSummary ? (
            <Card className="border-0">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
              </CardContent>
            </Card>
          ) : !analysisFailed ? (
            <Card className="border-0">
              <CardContent className="p-5 space-y-2">
                <div className="h-3 w-full rounded shimmer-block" />
                <div className="h-3 w-4/5 rounded shimmer-block" />
                <div className="h-3 w-3/5 rounded shimmer-block" />
              </CardContent>
            </Card>
          ) : null}

          {/* Detailed Feedback (below transcript on left) */}
          {hasFeedback ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detailed Feedback</h3>
              {detailedFeedback.map((fb, i) => (
                <Card key={i} className="border-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Q: {fb.question}</p>
                        <p className="text-sm text-muted-foreground mt-1">A: {fb.answer}</p>
                      </div>
                      <div className={`text-lg font-bold shrink-0 ${scoreColor(fb.score)}`}>{fb.score}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Feedback</p>
                      <p className="text-sm">{fb.feedback}</p>
                    </div>
                    {fb.suggested_answer && (
                      <div className="bg-accent/5 rounded-lg p-3 border border-accent/10">
                        <p className="text-xs font-medium text-accent mb-1">Suggested Answer</p>
                        <p className="text-sm text-muted-foreground">{fb.suggested_answer}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !analysisFailed && !hasFeedback ? (
            <Card className="border-0">
              <CardContent className="p-5 space-y-3">
                <div className="h-3 w-32 rounded shimmer-block" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 p-3 rounded-lg border border-border/50">
                    <div className="h-3 w-3/4 rounded shimmer-block" />
                    <div className="h-3 w-1/2 rounded shimmer-block" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* RIGHT COLUMN: Score Sidebar */}
        <div className="space-y-4">
          {!isMobile && scoreWidgets}

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <Card className="border-0">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Red Flags
                </h3>
                <div className="space-y-2">
                  {redFlags.map((flag, i) => (
                    <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-orange-500 mt-1 shrink-0">•</span>
                      {flag}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grammar Mistakes */}
          {grammarMistakes.length > 0 && (
            <Card className="border-0">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-500" /> Grammar ({grammarMistakes.length})
                </h3>
                <div className="space-y-2.5">
                  {grammarMistakes.map((m, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-red-500 line-through">{m.original}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="text-emerald-600 font-medium">{m.corrected}</span>
                      {m.explanation && <p className="text-xs text-muted-foreground mt-0.5">{m.explanation}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Improvement Plan */}
          {improvementPlan.length > 0 && (
            <Card className="border-0">
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

          {/* No issues detected */}
          {hasIssues === false && grammarMistakes.length === 0 && redFlags.length === 0 && hasScores && (
            <Card className="border-0">
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-sm text-muted-foreground">No grammar mistakes or red flags detected!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
