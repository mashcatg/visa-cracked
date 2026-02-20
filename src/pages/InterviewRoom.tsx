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

function SpeakingWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full bg-green-400 transition-all duration-150 ${
            active ? "animate-pulse" : ""
          }`}
          style={{
            height: active ? `${8 + Math.random() * 12}px` : "4px",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

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

        // Client-side SDK initiates the call with assistantId
        vapi.start(data.assistantId);
      } catch (err: any) {
        console.error("Failed to start mock test:", err);
        toast.error("Failed to start mock test");
        setIsLoading(false);
      }
    }

    startCall();
    return () => { vapiRef.current?.stop(); };
  }, [id]);

  const handleCallEnd = useCallback(async () => {
    setIsConnected(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    toast.info("Mock test ended. Analyzing results...");

    try {
      await supabase.functions.invoke("get-interview-results", { body: { interviewId: id } });
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

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#16162a] border-b border-white/5">
        <h1 className="text-base font-semibold text-white">Mock Test Room</h1>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 gap-4 relative">
        {/* Interviewer avatar area */}
        <div className={`w-full ${isMobile ? "max-w-full" : "max-w-3xl"} aspect-video rounded-2xl bg-[#0f0f23] border border-white/5 flex items-center justify-center relative overflow-hidden`}>
          <div className="flex flex-col items-center gap-3">
            <div className={`h-20 w-20 md:h-24 md:w-24 rounded-full bg-accent/20 flex items-center justify-center ${isSpeaking === "assistant" ? "ring-4 ring-accent/50 ring-offset-2 ring-offset-[#0f0f23]" : ""} transition-all`}>
              <User className="h-10 w-10 md:h-12 md:w-12 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Visa Officer</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <SpeakingWaveform active={isSpeaking === "assistant"} />
                <span className="text-xs text-white/50">
                  {isLoading ? "Connecting..." : isSpeaking === "assistant" ? "Speaking" : "Listening"}
                </span>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f23]/80 backdrop-blur-sm">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-accent" />
                <p className="text-white font-medium">Connecting to interviewer...</p>
                <p className="text-xs text-white/40 mt-1">Please allow camera and microphone access</p>
              </div>
            </div>
          )}
        </div>

        {/* Self-view PIP */}
        <div className={`absolute ${isMobile ? "bottom-40 right-4 w-28 h-20" : "bottom-28 right-8 w-48 h-36"} rounded-xl overflow-hidden border-2 ${isSpeaking === "user" ? "border-accent" : "border-white/10"} shadow-2xl transition-colors`}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 bg-[#1a1a2e] flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-sm font-bold text-accent">{initials}</span>
              </div>
            </div>
          )}
          {isSpeaking === "user" && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
              <SpeakingWaveform active />
            </div>
          )}
        </div>

        {/* Subtitles */}
        <div className={`w-full ${isMobile ? "max-w-full" : "max-w-3xl"} space-y-2 min-h-[60px]`}>
          {assistantSubtitle && (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 mb-0.5">Interviewer</p>
              <p className="text-white text-sm">{assistantSubtitle}</p>
            </div>
          )}
          {userSubtitle && (
            <div className="bg-accent/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 mb-0.5">You</p>
              <p className="text-white text-sm">{userSubtitle}</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-4 md:py-5 bg-[#16162a] border-t border-white/5">
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
