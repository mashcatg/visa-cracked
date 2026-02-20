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
  const [userSubtitle, setUserSubtitle] = useState("");
  const [assistantSubtitle, setAssistantSubtitle] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good");
  const [connectingMsgIdx, setConnectingMsgIdx] = useState(0);

  // Rotating connecting messages
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setConnectingMsgIdx((i) => (i + 1) % CONNECTING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

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
              const text = (message.transcript || "").toLowerCase();
              if (FAREWELL_PHRASES.some((phrase) => text.includes(phrase))) {
                setTimeout(() => { vapiRef.current?.stop(); }, 2000);
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

        const call = await vapi.start(data.assistantId);
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

      // Navigate to report immediately
      navigate(`/interview/${id}/report`);
      // Fire AI analysis in background
      supabase.functions.invoke("analyze-interview", { body: { interviewId: id } }).catch(console.error);
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

      {/* Main area - User camera is the main view (Google Meet style) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* User video - MAIN VIEW */}
        <div className="w-full h-full relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!camOn && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#002A26] via-[#003B36] to-[#002A26] flex items-center justify-center">
              <div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-3xl md:text-4xl font-bold text-accent">{initials}</span>
              </div>
            </div>
          )}
        </div>

        {/* Officer avatar - floating card top-left */}
        <div className={`absolute ${isMobile ? "top-3 left-3" : "top-4 left-4"} z-10`}>
          <div className={`${isMobile ? "w-20 h-20" : "w-28 h-28"} rounded-2xl bg-[#002A26]/90 backdrop-blur-md border ${isSpeaking === "assistant" ? "border-accent/60 shadow-lg shadow-accent/20" : "border-white/10"} flex flex-col items-center justify-center gap-1.5 transition-all duration-300`}>
            <div className={`${isMobile ? "h-10 w-10" : "h-12 w-12"} rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center transition-all duration-300 ${isSpeaking === "assistant" ? "ring-2 ring-accent/40 scale-110" : ""}`}>
              <User className={`${isMobile ? "h-5 w-5" : "h-6 w-6"} text-accent/80`} />
            </div>
            <span className="text-white/70 text-[10px] font-medium">
              {isSpeaking === "assistant" ? "Speaking..." : "Officer"}
            </span>
          </div>
        </div>

        {/* Connecting overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#002A26]/90 backdrop-blur-md z-20">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 -m-6 rounded-full bg-accent/10 blur-3xl animate-pulse" />
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-accent relative z-10" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg transition-all duration-500 min-h-[28px]">
                  {CONNECTING_MESSAGES[connectingMsgIdx]}
                </p>
                <p className="text-xs text-white/40 mt-2">Please allow camera & microphone access</p>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {CONNECTING_MESSAGES.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === connectingMsgIdx ? "bg-accent w-4" : "bg-white/20 w-1.5"}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Subtitles overlay - bottom center */}
        {isConnected && (assistantSubtitle || userSubtitle) && (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${isMobile ? "w-[90%]" : "max-w-2xl w-full"} z-10`}>
            <div className="bg-black/70 backdrop-blur-md rounded-xl px-5 py-3.5 space-y-2">
              {assistantSubtitle && (
                <p className="text-white text-sm md:text-base leading-relaxed">
                  <span className="text-white/50 text-xs font-semibold mr-2">Officer</span>
                  {assistantSubtitle}
                </p>
              )}
              {userSubtitle && (
                <p className="text-white text-sm md:text-base leading-relaxed">
                  <span className="text-accent text-xs font-semibold mr-2">You</span>
                  {userSubtitle}
                </p>
              )}
            </div>
          </div>
        )}
        {isConnected && !assistantSubtitle && !userSubtitle && (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10`}>
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
              <p className="text-white/30 text-xs">Listening...</p>
            </div>
          </div>
        )}
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
