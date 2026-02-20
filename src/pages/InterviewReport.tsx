import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, XCircle, Loader2, TrendingUp, Shield, MessageSquare, Award, Copy, Play, Mic2, BookOpen, Brain, Target, ArrowLeft, XOctagon } from "lucide-react";
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

const ANALYZING_MESSAGES = [
  "Fetching your interview transcript...",
  "Analyzing your responses with AI...",
  "Evaluating grammar and pronunciation...",
  "Checking for red flags...",
  "Generating detailed feedback...",
  "Scoring your confidence level...",
  "Almost there, preparing your report...",
];

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [analyzingMsgIdx, setAnalyzingMsgIdx] = useState(0);
  const pollCountRef = useRef(0);
  const isMobile = useIsMobile();

  // Rotating analyzing messages
  useEffect(() => {
    if (report || loading) return;
    const interval = setInterval(() => {
      setAnalyzingMsgIdx((i) => (i + 1) % ANALYZING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [report, loading]);

  // Fetch interview + report, with polling if report is missing
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
      }
      setLoading(false);
      return interviewData;
    }

    fetchData().then((data) => {
      // If no report yet and status is completed, poll
      if (data && !data.interview_reports && data.status !== "failed") {
        const pollInterval = setInterval(async () => {
          pollCountRef.current += 1;
          if (pollCountRef.current > 30) {
            clearInterval(pollInterval);
            return;
          }
          const { data: fresh } = await supabase
            .from("interview_reports")
            .select("*")
            .eq("interview_id", id)
            .maybeSingle();
          if (fresh) {
            setReport(fresh);
            clearInterval(pollInterval);
          }
        }, 5000);
        return () => clearInterval(pollInterval);
      }
    });
  }, [id]);

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
    if (interview?.transcript) {
      navigator.clipboard.writeText(interview.transcript);
      toast.success("Transcript copied!");
    }
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

  // Failed state
  if (interview.status === "failed") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md w-full text-center p-8">
          <XOctagon className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Mock Test Failed</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The call could not be completed. No credits were deducted from your account.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const overallScore = report?.overall_score ?? 0;
  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";
  const scoreLabel = (score: number) =>
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work";

  const grammarMistakes: GrammarMistake[] = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
  const redFlags: string[] = Array.isArray(report?.red_flags) ? report.red_flags : [];
  const improvementPlan: string[] = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];
  const detailedFeedback: DetailedFeedback[] = Array.isArray(report?.detailed_feedback) ? report.detailed_feedback : [];

  const categories = [
    { label: "English", score: report?.english_score, icon: MessageSquare, color: "text-blue-500" },
    { label: "Confidence", score: report?.confidence_score, icon: Award, color: "text-purple-500" },
    { label: "Financial", score: report?.financial_clarity_score, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Intent", score: report?.immigration_intent_score, icon: Shield, color: "text-amber-500" },
    { label: "Pronunciation", score: report?.pronunciation_score, icon: Mic2, color: "text-pink-500" },
    { label: "Vocabulary", score: report?.vocabulary_score, icon: BookOpen, color: "text-cyan-500" },
    { label: "Relevance", score: report?.response_relevance_score, icon: Brain, color: "text-indigo-500" },
  ];

  // Parse messages for chat transcript
  const messages: any[] = Array.isArray(interview.messages) ? interview.messages : [];
  const chatMessages = messages.filter((m: any) => (m.role === "assistant" || m.role === "user") && m.content);

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
            <p className="text-muted-foreground text-sm">
              {(interview.countries as any)?.flag_emoji} {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name} • {new Date(interview.created_at).toLocaleDateString()}
              {interview.duration && ` • ${Math.floor(interview.duration / 60)}m ${interview.duration % 60}s`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {interview.recording_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={interview.recording_url} target="_blank" rel="noreferrer">
                <Play className="h-3.5 w-3.5 mr-1.5" /> Listen
              </a>
            </Button>
          )}
          <Button onClick={downloadReport} disabled={downloading} variant="outline" size="sm">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Download Report
          </Button>
        </div>
      </div>

      {!report ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 -m-4 rounded-full bg-accent/10 blur-2xl animate-pulse" />
              <Loader2 className="h-10 w-10 animate-spin text-accent relative z-10" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground transition-all duration-500 min-h-[24px]">
                {ANALYZING_MESSAGES[analyzingMsgIdx]}
              </p>
              <p className="text-sm text-muted-foreground">This usually takes 1–2 minutes</p>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {ANALYZING_MESSAGES.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === analyzingMsgIdx ? "bg-accent w-4" : "bg-muted-foreground/20 w-1.5"}`} />
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Overall Score + Category Scores */}
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
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
                <p className="text-primary-foreground/60 text-xs text-center">
                  {scoreLabel(overallScore)}
                </p>
              </CardContent>
            </Card>

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
          </div>

          {/* Summary */}
          {report.summary && (
            <Card>
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Main content tabs */}
          <Tabs defaultValue="feedback" className="w-full">
            <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="feedback" className="text-xs sm:text-sm">Detailed Feedback</TabsTrigger>
              <TabsTrigger value="grammar" className="text-xs sm:text-sm">Grammar ({grammarMistakes.length})</TabsTrigger>
              <TabsTrigger value="flags" className="text-xs sm:text-sm">Red Flags ({redFlags.length})</TabsTrigger>
              <TabsTrigger value="plan" className="text-xs sm:text-sm">Improvement</TabsTrigger>
              <TabsTrigger value="transcript" className="text-xs sm:text-sm">Transcript</TabsTrigger>
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
                <Card className="p-6 text-center text-muted-foreground text-sm">No detailed feedback available</Card>
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

            <TabsContent value="transcript" className="mt-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Conversation</CardTitle>
                  <Button variant="ghost" size="sm" onClick={copyTranscript} className="text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
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
                    ) : interview.transcript ? (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {interview.transcript}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No transcript available</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {interview.recording_url && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Recording</p>
                <audio controls className="w-full" src={interview.recording_url} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
