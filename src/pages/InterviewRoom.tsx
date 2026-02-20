import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PhoneOff, Loader2, Clock, Wifi, User, Mic, MicOff, Subtitles } from "lucide-react";
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
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [connectingCycled, setConnectingCycled] = useState(false);

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

      navigate(`/interview/${id}/report`);
      supabase.functions.invoke("analyze-interview", { body: { interviewId: id } }).catch(console.error);
    } catch {
      toast.error("Error processing results");
      navigate(`/interview/${id}/report`);
    }
  }, [id, navigate]);

  const remaining = MAX_DURATION - elapsed;
  const qualityColor = connectionQuality === "good" ? "bg-green-500" : connectionQuality === "fair" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="fixed inset-0 bg-[#003B36] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#002A26]/80 backdrop-blur-sm border-b border-white/5 z-10">
        <h1 className="text-sm font-semibold text-white/80">Visa Cracked — Mock Test</h1>
        <div className="flex items-center gap-4">
          {isConnected && (
            <>
              <div className={`flex items-center gap-2 text-sm font-mono ${remaining <= 30 ? "text-red-400" : "text-white/70"}`}>
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(remaining)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-white/50" />
                <div className={`h-2 w-2 rounded-full ${qualityColor}`} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Main view: Bot avatar by default, user video if swapped */}
        {!swapped ? (
          /* Bot avatar - MAIN */
          <div className="w-full h-full bg-gradient-to-br from-[#002A26] via-[#003B36] to-[#002A26] flex items-center justify-center">
            <div className="relative">
              {/* Pulsing rings when speaking */}
              {isSpeaking === "assistant" && (
                <>
                  <div className="absolute inset-0 -m-8 rounded-full bg-accent/10 animate-ping" style={{ animationDuration: "2s" }} />
                  <div className="absolute inset-0 -m-4 rounded-full bg-accent/5 animate-pulse" />
                </>
              )}
              <div className={`${isMobile ? "h-32 w-32" : "h-44 w-44"} rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center border-2 ${isSpeaking === "assistant" ? "border-accent/60" : "border-white/10"} transition-all duration-300`}>
                <User className={`${isMobile ? "h-16 w-16" : "h-20 w-20"} text-accent/70`} />
              </div>
              <p className="text-center text-white/50 text-xs mt-4 font-medium">
                {isSpeaking === "assistant" ? "Speaking..." : "Visa Officer"}
              </p>
            </div>
          </div>
        ) : (
          /* User video - MAIN (when swapped) */
          <div className="w-full h-full relative">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>
        )}

        {/* PIP: User camera (top-right) or Bot avatar (top-right if swapped) */}
        <div
          className={`absolute ${isMobile ? "top-3 right-3" : "top-4 right-4"} z-10 cursor-pointer`}
          onClick={() => setSwapped((s) => !s)}
        >
          {!swapped ? (
            /* User camera PIP */
            <div className={`${isMobile ? "w-[100px] h-[140px]" : "w-[160px] h-[200px]"} rounded-xl overflow-hidden border-2 border-white/20 bg-[#002A26]`}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            </div>
          ) : (
            /* Bot avatar PIP */
            <div className={`${isMobile ? "w-20 h-20" : "w-28 h-28"} rounded-full bg-[#002A26]/90 backdrop-blur-md border ${isSpeaking === "assistant" ? "border-accent/60" : "border-white/10"} flex flex-col items-center justify-center gap-1.5 transition-all duration-300`}>
              <div className={`${isMobile ? "h-10 w-10" : "h-12 w-12"} rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center ${isSpeaking === "assistant" ? "ring-2 ring-accent/40 scale-110" : ""} transition-all duration-300`}>
                <User className={`${isMobile ? "h-5 w-5" : "h-6 w-6"} text-accent/80`} />
              </div>
              <span className="text-white/70 text-[10px] font-medium">
                {isSpeaking === "assistant" ? "Speaking..." : "Officer"}
              </span>
            </div>
          )}
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
                <p className="text-white font-semibold text-lg transition-all duration-500 min-h-[28px] shimmer-text-light">
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

        {/* Single-line transcript bar */}
        {subtitlesOn && isConnected && lastTranscript && (
          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 ${isMobile ? "w-[88%]" : "max-w-sm w-full"} z-10`}>
            <div className="bg-black/50 backdrop-blur-lg rounded-full px-4 py-1.5 flex items-center gap-1.5 overflow-hidden">
              <span className={`text-[10px] font-bold uppercase shrink-0 ${lastTranscript.role === "You" ? "text-accent" : "text-white/40"}`}>
                {lastTranscript.role}
              </span>
              <span className="text-white/90 text-xs truncate shimmer-text-light">{lastTranscript.text}</span>
            </div>
          </div>
        )}
        {subtitlesOn && isConnected && !lastTranscript && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-black/40 backdrop-blur-lg rounded-full px-3 py-1.5">
              <p className="text-white/30 text-[10px]">Listening...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 py-4 md:py-5 bg-[#002A26]/80 backdrop-blur-sm border-t border-white/5">
        <button
          onClick={() => {
            const newState = !micOn;
            setMicOn(newState);
            streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = newState; });
          }}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/80 hover:bg-red-500 text-white"}`}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setSubtitlesOn((s) => !s)}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${subtitlesOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-white/40"}`}
        >
          <Subtitles className="h-4 w-4" />
        </button>
        <Button
          className="rounded-full h-12 px-6 md:px-8 bg-red-600 hover:bg-red-700 text-white font-semibold"
          onClick={() => vapiRef.current?.stop()}
          disabled={!isConnected}
        >
          <PhoneOff className="h-5 w-5 mr-2" />
          {isMobile ? "End" : "End Mock Test"}
        </Button>
      </div>
    </div>
  );
}
