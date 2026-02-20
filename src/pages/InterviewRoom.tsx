import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, Clock, Wifi, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const PROCESSING_MESSAGES = [
  "Fetching your interview transcript...",
  "Analyzing your responses with AI...",
  "Evaluating grammar and pronunciation...",
  "Checking for red flags...",
  "Generating detailed feedback...",
  "Scoring your confidence level...",
  "Almost there, preparing your report...",
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
  const [userSubtitle, setUserSubtitle] = useState("");
  const [assistantSubtitle, setAssistantSubtitle] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsgIdx, setProcessingMsgIdx] = useState(0);

  // Rotating processing messages
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setProcessingMsgIdx((i) => (i + 1) % PROCESSING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Elapsed timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // HD Camera setup
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "m" || e.key === "M") toggleMic();
      if (e.key === "v" || e.key === "V") toggleCam();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [micOn, camOn]);

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
              setAssistantSubtitle(message.transcript);
              setIsSpeaking("assistant");

              // Auto-stop if bot says farewell
              const text = (message.transcript || "").toLowerCase();
              if (FAREWELL_PHRASES.some((phrase) => text.includes(phrase))) {
                setTimeout(() => {
                  vapiRef.current?.stop();
                }, 2000);
              }
            } else {
              setUserSubtitle(message.transcript);
              setIsSpeaking("user");
            }
          }
        });

        vapi.on("error", (error: any) => {
          console.error("Vapi error:", error);
          toast.error("Voice connection error");
          setConnectionQuality("poor");
        });

        vapi.start(data.assistantId);
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
    setIsProcessing(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    toast.info("Mock test ended. Fetching results...");

    try {
      const { data: resultData } = await supabase.functions.invoke("get-interview-results", { body: { interviewId: id } });
      
      if (resultData?.status === "failed") {
        toast.error("Mock test call failed. No credits were deducted.");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      toast.info("Analyzing your performance with AI...");
      await supabase.functions.invoke("analyze-interview", { body: { interviewId: id } });
      navigate(`/interview/${id}/report`);
    } catch {
      toast.error("Error processing results");
      navigate(`/interview/${id}/report`);
    }
  }, [id, navigate]);

  function toggleMic() {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setMicOn((v) => !v);
    }
  }

  function toggleCam() {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setCamOn((v) => !v);
    }
  }

  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "ME";

  const qualityColor = connectionQuality === "good" ? "bg-green-500" : connectionQuality === "fair" ? "bg-amber-500" : "bg-red-500";

  // Processing screen with rotating messages
  if (isProcessing) {
    return (
      <div className="fixed inset-0 bg-[#003B36] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 -m-6 rounded-full bg-accent/10 blur-3xl animate-pulse" />
          <Loader2 className="h-14 w-14 animate-spin text-accent relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-white text-lg font-semibold transition-all duration-500 min-h-[28px]">
            {PROCESSING_MESSAGES[processingMsgIdx]}
          </p>
          <p className="text-white/40 text-sm">This usually takes 1–2 minutes</p>
        </div>
        <div className="flex items-center gap-1.5 mt-4">
          {PROCESSING_MESSAGES.map((_, i) => (
            <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === processingMsgIdx ? "bg-accent w-4" : "bg-white/20"}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#003B36] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#002A26]/80 backdrop-blur-sm border-b border-white/5 z-10">
        <h1 className="text-sm font-semibold text-white/80">Visa Cracked — Mock Test</h1>
        <div className="flex items-center gap-4">
          {isConnected && (
            <>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono">{formatTime(elapsed)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-white/50" />
                <div className={`h-2 w-2 rounded-full ${qualityColor}`} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main area - Interviewer + PIP */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Interviewer area - full bleed */}
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#002A26] via-[#003B36] to-[#002A26]">
          {/* Animated orb behind avatar */}
          <div className="relative flex flex-col items-center gap-4">
            <div className={`absolute inset-0 -m-8 rounded-full bg-accent/5 blur-3xl transition-all duration-1000 ${isSpeaking === "assistant" ? "scale-150 opacity-60" : "scale-100 opacity-20"}`} />
            <div className={`relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center transition-all duration-300 ${isSpeaking === "assistant" ? "ring-4 ring-accent/40 scale-105" : ""}`}>
              <User className="h-12 w-12 md:h-16 md:w-16 text-accent/80" />
            </div>
            <div className="text-center z-10">
              <p className="text-white font-semibold text-lg">Visa Officer</p>
              <p className="text-white/40 text-xs mt-0.5">
                {isLoading ? "Connecting..." : isSpeaking === "assistant" ? "Speaking..." : "Listening"}
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#002A26]/90 backdrop-blur-md z-20">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-accent" />
                <p className="text-white font-medium">Connecting to interviewer...</p>
                <p className="text-xs text-white/40 mt-1">Please allow camera & microphone</p>
              </div>
            </div>
          )}
        </div>

        {/* Self-view PIP - top right corner */}
        <div className={`absolute ${isMobile ? "top-3 right-3 w-24 h-32" : "top-4 right-4 w-44 h-32"} rounded-xl overflow-hidden border-2 ${isSpeaking === "user" ? "border-accent" : "border-white/10"} shadow-2xl transition-colors z-10 bg-[#003B36]`}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 bg-[#003B36] flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-sm font-bold text-accent">{initials}</span>
              </div>
            </div>
          )}
        </div>

        {/* Subtitles overlay - bottom of main area */}
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${isMobile ? "w-[90%]" : "max-w-2xl w-full"} space-y-1.5 z-10`}>
          {assistantSubtitle && (
            <div className="bg-black/60 backdrop-blur-md rounded-lg px-4 py-2.5 text-center">
              <p className="text-white text-sm leading-relaxed">{assistantSubtitle}</p>
            </div>
          )}
          {userSubtitle && (
            <div className="bg-accent/20 backdrop-blur-md rounded-lg px-4 py-2 text-center">
              <p className="text-white/90 text-xs">{userSubtitle}</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 py-4 md:py-5 bg-[#002A26]/80 backdrop-blur-sm border-t border-white/5 relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full h-12 w-12 ${micOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 hover:bg-red-500/30 text-red-400"}`}
            onClick={toggleMic}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full h-12 w-12 ${camOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 hover:bg-red-500/30 text-red-400"}`}
            onClick={toggleCam}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </div>
        <Button
          className="rounded-full h-12 px-6 md:px-8 bg-red-600 hover:bg-red-700 text-white font-semibold"
          onClick={() => vapiRef.current?.stop()}
          disabled={!isConnected}
        >
          <PhoneOff className="h-5 w-5 mr-2" />
          {isMobile ? "End" : "End Mock Test"}
        </Button>
        {!isMobile && (
          <div className="absolute right-6 bottom-5 text-xs text-white/20 space-x-3">
            <span>M — mute</span>
            <span>V — camera</span>
          </div>
        )}
      </div>
    </div>
  );
}
