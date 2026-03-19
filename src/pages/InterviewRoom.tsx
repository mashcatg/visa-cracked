import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PhoneOff, Loader2, Clock, Wifi, User, Mic, MicOff, Subtitles, Headphones, Volume2, Lightbulb, CheckCircle2, Volume, AlertCircle, CheckCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const MAX_DURATION = 207; // 3:27

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(1, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const CONNECTING_MESSAGES = [
  "Preparing your interview environment...",
  "Setting up secure connection...",
  "Loading interview questions...",
  "Almost ready...",
];

const FAREWELL_PHRASES = [
  "call ended", "goodbye", "interview is over", "that concludes",
  "thank you for your time", "end of the interview", "have a good day",
  "all the best", "interview is complete", "that's all",
];

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const vapiRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState<"user" | "assistant" | null>(null);
  const [lastTranscript, setLastTranscript] = useState<{ role: string; text: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good");
  const [connectingMsgIdx, setConnectingMsgIdx] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [assistantMuted, setAssistantMuted] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [connectingCycled, setConnectingCycled] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(true);
  const [callData, setCallData] = useState<any>(null);

  // Rotating connecting messages — lock on last after one cycle
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setConnectingMsgIdx((i) => {
        if (i >= CONNECTING_MESSAGES.length - 1) {
          setConnectingCycled(true);
          return CONNECTING_MESSAGES.length - 1;
        }
        return i + 1;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Countdown timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-end at MAX_DURATION
  useEffect(() => {
    if (!isConnected) return;
    if (elapsed >= MAX_DURATION) {
      vapiRef.current?.stop();
    } else if (elapsed === MAX_DURATION - 30) {
      toast.warning("30 seconds remaining");
    }
  }, [elapsed, isConnected]);

  // Camera setup
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((mediaStream) => {
        streamRef.current = mediaStream;
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      })
      .catch(() => toast.error("Camera/microphone access required"));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Start Vapi call
  useEffect(() => {
    if (!id) return;

    async function startCall() {
      try {
        const { data, error } = await supabase.functions.invoke("start-interview", {
          body: { interviewId: id },
        });
        if (error) throw error;

        const Vapi = (await import("@vapi-ai/web")).default;
        const vapi = new Vapi(data.publicKey);
        vapiRef.current = vapi;

        vapi.on("call-start", () => {
          setIsConnected(true);
          setIsLoading(false);
          setConnectionQuality("good");
        });

        vapi.on("call-end", () => handleCallEnd());
        vapi.on("speech-start", () => setIsSpeaking("assistant"));
        vapi.on("speech-end", () => setIsSpeaking(null));

        vapi.on("message", (message: any) => {
          if (message.type === "transcript") {
            if (message.role === "assistant") {
              setLastTranscript({ role: "Officer", text: message.transcript });
              setIsSpeaking("assistant");
              const text = (message.transcript || "").toLowerCase();
              if (FAREWELL_PHRASES.some((phrase) => text.includes(phrase))) {
                setTimeout(() => { vapiRef.current?.stop(); }, 2000);
              }
            } else {
              setLastTranscript({ role: "You", text: message.transcript });
              setIsSpeaking("user");
            }
          }
        });

        vapi.on("error", (error: any) => {
          console.error("Vapi error:", error);
          toast.error("Voice connection error");
          setConnectionQuality("poor");
        });

        const call = await (vapi as any).start(data.assistantId, {
          variableValues: data.variableValues || {},
        });
        setCallData(call);
        if (call?.id) {
          await supabase.from("interviews").update({ vapi_call_id: call.id }).eq("id", id);
        }
      } catch (err: any) {
        console.error("Failed to start mock test:", err);
        toast.error("Failed to start mock test. Returning to dashboard.");
        setIsLoading(false);
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    }

    startCall();
    return () => { vapiRef.current?.stop(); };
  }, [id]);

  const handleCallEnd = useCallback(async () => {
    setIsConnected(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    toast.info("Mock test ended. Preparing your report...");

    try {
      const { data: resultData } = await supabase.functions.invoke("get-interview-results", { body: { interviewId: id } });
      
      if (resultData?.status === "failed") {
        toast.error("Mock test call failed. No credits were deducted.");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      navigate(`/interview/${id}/report`);
      supabase.functions.invoke("analyze-interview", { body: { interviewId: id } }).catch(console.error);
    } catch {
      toast.error("Error processing results");
      navigate(`/interview/${id}/report`);
    }
  }, [id, navigate]);

  const toggleAssistantMute = useCallback(async () => {
    if (!callData?.monitor?.controlUrl) {
      toast.error("Unable to control assistant");
      return;
    }

    try {
      const newMutedState = !assistantMuted;
      const response = await fetch(callData.monitor.controlUrl, {
        method: "POST",
        body: JSON.stringify({
          action: newMutedState ? "mute-assistant-mic" : "unmute-assistant-mic",
        }),
      });

      if (response.ok) {
        setAssistantMuted(newMutedState);
        toast.info(newMutedState ? "Assistant muted" : "Assistant unmuted");
      } else {
        toast.error("Failed to control assistant");
      }
    } catch (err) {
      console.error("Mute error:", err);
      toast.error("Error controlling assistant");
    }
  }, [callData, assistantMuted]);

  const remaining = MAX_DURATION - elapsed;
  const qualityColor = connectionQuality === "good" ? "bg-green-500" : connectionQuality === "fair" ? "bg-amber-500" : "bg-red-500";

  return (
    <>
      {/* Pre-Interview Setup Guide */}
      <Dialog open={showSetupGuide} onOpenChange={setShowSetupGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Prepare for Your Interview</DialogTitle>
            <DialogDescription className="text-center mt-2">Make sure you're ready to start</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Headphones className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Use Headphones</p>
                  <p className="text-xs text-muted-foreground">Headphones are recommended for clear audio and better connection quality</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Volume2 className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Quiet Environment</p>
                  <p className="text-xs text-muted-foreground">Find a quiet place without background noise or distractions</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Good Lighting</p>
                  <p className="text-xs text-muted-foreground">Ensure proper lighting so your face is clearly visible</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Check Camera & Microphone</p>
                  <p className="text-xs text-muted-foreground">Test your camera and microphone before starting the interview</p>
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              onClick={() => setShowSetupGuide(false)}
            >
              I'm Ready
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Interview Room */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary via-primary/95 to-secondary flex flex-col">
        {/* Premium Header */}
        <div className="relative z-20 bg-gradient-to-r from-primary/70 to-secondary/70 backdrop-blur-xl border-b border-border/40 shadow-2xl">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary rounded-lg blur opacity-50" />
                <div className="relative bg-primary px-3 py-1.5 rounded-lg">
                  <h1 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-secondary">VISA CRACKED</h1>
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? "bg-accent/20 text-accent" : "bg-secondary/20 text-secondary"}`}>
                {isConnected ? "● Live" : "● Connecting"}
              </span>
            </div>

            {/* Center: Status Info */}
            {isConnected && (
              <div className="flex items-center gap-6 text-xs md:text-sm">
                {/* Timer */}
                <div className={`flex items-center gap-2 font-mono font-semibold px-3 py-1.5 rounded-lg backdrop-blur-md transition-all ${
                  remaining <= 30 
                    ? "bg-destructive/10 text-destructive border border-destructive/30" 
                    : "bg-secondary/20 text-secondary border border-border/40"
                }`}>
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(remaining)}</span>
                </div>

                {/* Connection Quality */}
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-secondary/70" />
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1 rounded-full transition-all ${
                          connectionQuality === "good" ? "bg-accent" : connectionQuality === "fair" ? "bg-secondary" : "bg-destructive"
                        } ${i < (connectionQuality === "good" ? 4 : connectionQuality === "fair" ? 2 : 1) ? "opacity-100" : "opacity-30"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Right: Badge */}
            <div className="hidden md:flex items-center gap-2 text-xs text-secondary/70">
              <CheckCheck className="h-4 w-4 text-accent" />
              <span>Secure Connection</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Background Grid Effect */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(100,200,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px] opacity-20" />
          
          {/* Main Display */}
          {!swapped ? (
            /* Officer Avatar - Professional Design */
            <div className="relative z-10 flex flex-col items-center gap-4">
              {/* Animated Background Glow */}
              <div className="absolute -inset-20 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 blur-3xl animate-pulse" />
              
              {/* Avatar Container */}
              <div className="relative">
                {/* Speaking Rings Animation */}
                {isSpeaking === "assistant" && (
                  <>
                    <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="absolute inset-0 -m-5 rounded-full border border-accent/30 animate-pulse" style={{ animationDuration: "1.5s" }} />
                  </>
                )}
                
                {/* Avatar Circle */}
                <div className={`relative ${isMobile ? "h-40 w-40" : "h-56 w-56"} rounded-full bg-gradient-to-br from-primary/70 to-secondary/70 flex items-center justify-center border-2 transition-all duration-300 ${
                  isSpeaking === "assistant" 
                    ? "border-accent shadow-lg shadow-accent/30" 
                    : "border-border"
                }`}>
                  <User className={`${isMobile ? "h-20 w-20" : "h-28 w-28"}`} style={{ color: isSpeaking === "assistant" ? "hsl(var(--accent))" : "hsl(var(--secondary))" }} />
                </div>
              </div>

              {/* Status Label */}
              <div className="relative z-10 text-center">
                <p className="text-foreground font-semibold text-lg md:text-xl">
                  {isSpeaking === "assistant" ? "🎤 Listening..." : "Visa Officer"}
                </p>
                <p className="text-secondary/80 text-xs md:text-sm mt-1">
                  {isConnected ? "Ready for your response" : "Connecting..."}
                </p>
              </div>
            </div>
          ) : (
            /* User Camera - Main View */
            <div className="w-full h-full relative">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {/* Video Overlay Effects */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/35 to-transparent" />
            </div>
          )}

          {/* Picture in Picture */}
          <div
            className={`absolute z-10 cursor-pointer transition-all hover:shadow-2xl hover:shadow-accent/30 ${isMobile ? "bottom-4 left-4" : "top-6 right-6"}`}
            onClick={() => setSwapped((s) => !s)}
          >
            {!swapped ? (
              /* User Camera PIP */
              <div className={`relative group rounded-2xl overflow-hidden border-2 border-border/60 bg-primary shadow-xl ${isMobile ? "w-24 h-32" : "w-48 h-60"}`}>
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {/* PIP Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-transparent p-2 text-xs font-medium text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  Your Camera
                </div>
              </div>
            ) : (
              /* Officer Avatar PIP */
              <div className={`relative group rounded-full bg-primary/80 backdrop-blur-md border border-border flex flex-col items-center justify-center gap-1 ${isMobile ? "h-20 w-20" : "h-28 w-28"}`}>
                <div className={`${isMobile ? "h-10 w-10" : "h-14 w-14"} rounded-full bg-gradient-to-br from-primary/80 to-secondary/70 flex items-center justify-center ${isSpeaking === "assistant" ? "ring-2 ring-accent/70 scale-110" : ""} transition-all duration-300`}>
                  <User className={`${isMobile ? "h-5 w-5" : "h-7 w-7"} text-accent`} />
                </div>
                {/* PIP Label */}
                <div className="text-foreground text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  OFFICER
                </div>
              </div>
            )}
          </div>

          {/* Transcript Display - Enhanced */}
          {subtitlesOn && isConnected && lastTranscript && (
            <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-10 transition-all ${isMobile ? "w-[90%]" : "max-w-2xl w-full"}`}>
              <div className={`backdrop-blur-xl rounded-2xl px-6 py-4 border transition-all ${
                lastTranscript.role === "You"
                  ? "bg-primary/25 border-primary/40"
                  : "bg-accent/20 border-accent/30"
              }`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${lastTranscript.role === "You" ? "text-secondary" : "text-accent"}`}>
                  {lastTranscript.role}
                </p>
                <p className="text-foreground text-sm leading-relaxed">{lastTranscript.text}</p>
              </div>
            </div>
          )}

          {/* Listening State */}
          {subtitlesOn && isConnected && !lastTranscript && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 bg-primary/30 backdrop-blur-lg rounded-full px-4 py-2 border border-border/40">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 bg-accent rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <p className="text-secondary text-xs font-medium">Listening...</p>
              </div>
            </div>
          )}

          {/* Connecting Overlay - Premium */}
          {isLoading && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-secondary/80 backdrop-blur-md flex items-center justify-center z-30">
              <div className="text-center space-y-6">
                {/* Animated Loader */}
                <div className="relative flex justify-center">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary rounded-full blur-2xl opacity-30 animate-pulse" />
                  <Loader2 className="h-16 w-16 animate-spin text-accent relative z-10" />
                </div>
                
                {/* Status Message */}
                <div className="space-y-2">
                  <p className="text-foreground font-bold text-xl transition-all duration-500">
                    {CONNECTING_MESSAGES[connectingMsgIdx]}
                  </p>
                  <p className="text-secondary/80 text-sm">Please allow camera & microphone access</p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2">
                  {CONNECTING_MESSAGES.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all ${i === connectingMsgIdx ? "bg-gradient-to-r from-accent to-primary h-2 w-8" : "bg-secondary/50 h-2 w-2"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Premium Controls Bar */}
        <div className="relative z-20 bg-card/90 backdrop-blur-xl border-t border-border/40 shadow-xl">
          <div className="flex items-center justify-center gap-3 px-4 py-6">
            {/* Microphone Control */}
            <button
              onClick={() => {
                const newState = !micOn;
                setMicOn(newState);
                streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = newState; });
              }}
              className={`group relative h-12 w-12 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                micOn 
                  ? "bg-secondary/20 hover:bg-secondary/30 text-foreground border border-border" 
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive/60"
              }`}
              title={micOn ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {micOn ? "Your Mic ON" : "Your Mic OFF"}
              </span>
            </button>

            {/* Assistant Mute Control */}
            {isConnected && (
              <button
                onClick={toggleAssistantMute}
                className={`group relative h-12 w-12 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                  assistantMuted 
                    ? "bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40" 
                    : "bg-secondary/20 hover:bg-secondary/30 text-foreground border border-border"
                }`}
                title={assistantMuted ? "Unmute Assistant" : "Mute Assistant"}
              >
                {assistantMuted ? <Volume className="h-5 w-5 translate-x-0.5" /> : <Volume2 className="h-5 w-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {assistantMuted ? "Assistant PAUSED" : "Pause Assistant"}
                </span>
              </button>
            )}

            {/* Subtitles Control */}
            <button
              onClick={() => setSubtitlesOn((s) => !s)}
              className={`group relative h-12 w-12 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                subtitlesOn 
                  ? "bg-accent hover:bg-accent/90 text-accent-foreground border border-accent/60" 
                  : "bg-secondary/20 hover:bg-secondary/30 text-muted-foreground border border-border"
              }`}
              title={subtitlesOn ? "Hide Subtitles" : "Show Subtitles"}
            >
              <Subtitles className="h-5 w-5" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {subtitlesOn ? "Captions ON" : "Captions OFF"}
              </span>
            </button>

            {/* End Call - Primary Action */}
            <div className="w-0.5 h-8 bg-gradient-to-b from-transparent via-border to-transparent mx-2" />
            
            <Button
              className="relative h-12 px-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-full transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => vapiRef.current?.stop()}
              disabled={!isConnected}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              {isMobile ? "End" : "End Mock Test"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
