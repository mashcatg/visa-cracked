import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, XCircle, Loader2, TrendingUp, Shield, MessageSquare, Award, Copy, Play, Mic2, BookOpen, Brain, Target, ArrowLeft, XOctagon, Clock, DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  cost: number | null;
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

  // Fetch Vapi data live
  async function fetchVapiData(interviewId: string) {
    setVapiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-vapi-data", {
        body: { interviewId },
      });
      if (!error && data) {
        setVapiData(data as VapiData);
      }
    } catch (e) {
      console.error("Failed to fetch Vapi data:", e);
    }
    setVapiLoading(false);
  }

  // Fetch interview + report, with polling for progressive report sections
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
        if (interviewData.interview_reports) {
          setReport(interviewData.interview_reports);
        }
        if (interviewData.vapi_call_id && interviewData.status === "completed") {
          fetchVapiData(id!);
        }
      }
      setLoading(false);
      return interviewData;
    }

    fetchData().then((data) => {
      if (data && data.status !== "failed") {
        pollStartRef.current = Date.now();
        
        const pollInterval = setInterval(async () => {
          const elapsed = Date.now() - pollStartRef.current;
          
          // 2 minute timeout
          if (elapsed > 120000) {
            clearInterval(pollInterval);
            // Check if we got ANY report data
            const currentReport = report;
            if (!currentReport || (!currentReport.summary && !currentReport.english_score && !currentReport.detailed_feedback)) {
              setAnalysisFailed(true);
            }
            return;
          }
          
          const { data: freshInterview } = await supabase
            .from("interviews")
            .select("*, countries(name, flag_emoji), visa_types(name), interview_reports(*)")
            .eq("id", id)
            .single();
          
          if (freshInterview) {
            setInterview(freshInterview);
            if (!vapiData && freshInterview.vapi_call_id && freshInterview.status === "completed") {
              fetchVapiData(id!);
            }
            if (freshInterview.interview_reports) {
              setReport(freshInterview.interview_reports);
              const r = freshInterview.interview_reports;
              // Stop polling once ALL sections are filled
              const hasSummary = r.summary != null;
              const hasScores = r.english_score != null;
              const hasIssues = Array.isArray(r.grammar_mistakes) && r.grammar_mistakes.length > 0;
              const hasFeedback = Array.isArray(r.detailed_feedback) && r.detailed_feedback.length > 0;
              if (hasSummary && hasScores && hasIssues && hasFeedback) {
                clearInterval(pollInterval);
              }
            }
          }
        }, 5000);
        return () => clearInterval(pollInterval);
      }
    });
  }, [id]);

  async function regenerateReport() {
    setRegenerating(true);
    setAnalysisFailed(false);
    pollStartRef.current = Date.now();
    try {
      await supabase.functions.invoke("analyze-interview", { body: { interviewId: id } });
      // Re-fetch report
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
      const blob = new Blob([Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `mock-report-${id}.txt`;
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

  if (interview.status === "failed") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md w-full text-center p-8">
          <XOctagon className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Mock Test Failed</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The call could not be completed. No credits were deducted.
          </p>
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

  // Progressive section detection
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
    { label: "English", score: report?.english_score, icon: MessageSquare, color: "text-accent" },
    { label: "Confidence", score: report?.confidence_score, icon: Award, color: "text-accent" },
    { label: "Financial", score: report?.financial_clarity_score, icon: TrendingUp, color: "text-accent" },
    { label: "Intent", score: report?.immigration_intent_score, icon: Shield, color: "text-accent" },
    { label: "Pronunciation", score: report?.pronunciation_score, icon: Mic2, color: "text-accent" },
    { label: "Vocabulary", score: report?.vocabulary_score, icon: BookOpen, color: "text-accent" },
    { label: "Relevance", score: report?.response_relevance_score, icon: Brain, color: "text-accent" },
  ];

  // Use live Vapi data for messages
  const rawMessages: any[] = vapiData?.messages ?? (Array.isArray(interview.messages) ? interview.messages : []);
  const chatMessages = rawMessages.filter((m: any) => (m.role === "assistant" || m.role === "user") && m.content);
  const recordingUrl = vapiData?.recordingUrl ?? interview.recording_url;
  const transcript = vapiData?.transcript ?? interview.transcript;
  const duration = vapiData?.duration ?? interview.duration;
  const cost = vapiData?.cost ?? interview.cost;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
              {cost != null && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> ${Number(cost).toFixed(2)}
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

      {/* Audio Player */}
      {recordingUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Play className="h-4 w-4 text-accent" />
              <p className="text-sm font-medium">Interview Recording</p>
            </div>
            <audio controls className="w-full" src={recordingUrl} />
          </CardContent>
        </Card>
      )}
      {vapiLoading && !recordingUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Loading recording...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript - always show from Vapi data */}
      {(chatMessages.length > 0 || transcript) && (
        <Card>
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
            <ScrollArea className="h-[400px] pr-4">
              {chatMessages.length > 0 ? (
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-accent/10 text-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                          {msg.role === "user" ? "You" : "Officer"}
                        </p>
                        {msg.content}
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

      {/* Analysis Failed */}
      {analysisFailed && !hasSummary && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-center space-y-3">
            <XOctagon className="h-10 w-10 text-destructive mx-auto" />
            <h3 className="font-semibold">AI Analysis Failed</h3>
            <p className="text-sm text-muted-foreground">The AI couldn't generate your report. This can happen due to high demand. Please try again.</p>
            <Button onClick={regenerateReport} disabled={regenerating} className="mt-2">
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Regenerate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overall Score + Category Scores */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Overall Score */}
        {hasSummary ? (
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6 flex flex-col items-center justify-center h-full">
              <div className="relative mb-3">
                <svg className="w-28 h-28" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="opacity-20" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={`${overallScore * 3.27} 327`}
                    strokeLinecap="round" transform="rotate(-90 60 60)"
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
          <Card className="bg-muted/30">
            <CardContent className="p-6 flex flex-col items-center justify-center h-full">
              <div className="w-28 h-28 rounded-full shimmer-block mb-3" />
              <div className="h-3 w-24 rounded shimmer-block mt-2" />
            </CardContent>
          </Card>
        ) : null}

        {/* Category Scores */}
        {hasScores ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <Card key={cat.label} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                    <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                  </div>
                  <div className={`text-2xl font-bold mb-1.5 ${scoreColor(cat.score ?? 0)}`}>
                    {cat.score ?? "—"}
                  </div>
                  <Progress value={cat.score ?? 0} className="h-1" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !analysisFailed ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {["English", "Confidence", "Financial", "Intent", "Pronunciation", "Vocabulary", "Relevance"].map((label) => (
              <Card key={label} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  <div className="h-3 w-16 rounded shimmer-block" />
                  <div className="h-8 w-12 rounded shimmer-block" />
                  <div className="h-1 w-full rounded shimmer-block" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Summary */}
      {hasSummary ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
          </CardContent>
        </Card>
      ) : !analysisFailed ? (
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="h-3 w-full rounded shimmer-block" />
            <div className="h-3 w-4/5 rounded shimmer-block" />
            <div className="h-3 w-3/5 rounded shimmer-block" />
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs for feedback details */}
      {(hasFeedback || hasIssues) ? (
        <Tabs defaultValue="feedback" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="feedback" className="text-xs sm:text-sm">Detailed Feedback</TabsTrigger>
            <TabsTrigger value="grammar" className="text-xs sm:text-sm">Grammar ({grammarMistakes.length})</TabsTrigger>
            <TabsTrigger value="flags" className="text-xs sm:text-sm">Red Flags ({redFlags.length})</TabsTrigger>
            <TabsTrigger value="plan" className="text-xs sm:text-sm">Improvement</TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="space-y-3 mt-4">
            {detailedFeedback.length > 0 ? detailedFeedback.map((fb, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
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
                      <p className="text-xs font-medium text-accent mb-1">💡 Better Answer</p>
                      <p className="text-sm text-muted-foreground">{fb.suggested_answer}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : (
              <Card className="p-6 text-center text-muted-foreground text-sm">No detailed feedback available yet</Card>
            )}
          </TabsContent>

          <TabsContent value="grammar" className="space-y-2 mt-4">
            {grammarMistakes.length > 0 ? grammarMistakes.map((m, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-600 line-through">{m.original}</p>
                      <p className="text-sm text-emerald-600 font-medium mt-0.5">✓ {m.corrected}</p>
                      {m.explanation && <p className="text-xs text-muted-foreground mt-1">{m.explanation}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="p-6 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No grammar mistakes detected!</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="flags" className="space-y-2 mt-4">
            {redFlags.length > 0 ? redFlags.map((flag, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm">{flag}</p>
                </CardContent>
              </Card>
            )) : (
              <Card className="p-6 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No red flags detected!</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plan" className="space-y-2 mt-4">
            {improvementPlan.map((item, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-accent">{i + 1}</span>
                  </div>
                  <p className="text-sm">{item}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      ) : !analysisFailed ? (
        // Shimmer for tabs section
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-2 mb-4">
              {["Detailed Feedback", "Grammar", "Red Flags", "Improvement"].map((t) => (
                <div key={t} className="h-8 w-28 rounded-md shimmer-block" />
              ))}
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg border border-border/50">
                <div className="h-3 w-3/4 rounded shimmer-block" />
                <div className="h-3 w-1/2 rounded shimmer-block" />
                <div className="h-3 w-2/3 rounded shimmer-block" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
