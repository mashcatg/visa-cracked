import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const vapiRef = useRef<any>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState<"user" | "assistant" | null>(null);
  const [userSubtitle, setUserSubtitle] = useState("");
  const [assistantSubtitle, setAssistantSubtitle] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Setup camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    }).catch(() => toast.error("Camera/microphone access required"));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
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
        });

        vapi.on("call-end", () => {
          handleCallEnd();
        });

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
        });

        vapi.start(data.callConfig);
      } catch (err: any) {
        console.error("Failed to start mock test:", err);
        toast.error("Failed to start mock test");
        setIsLoading(false);
      }
    }

    startCall();

    return () => {
      vapiRef.current?.stop();
    };
  }, [id]);

  async function handleCallEnd() {
    setIsConnected(false);
    stream?.getTracks().forEach((t) => t.stop());

    toast.info("Mock test ended. Analyzing results...");

    try {
      await supabase.functions.invoke("get-interview-results", {
        body: { interviewId: id },
      });

      await supabase.functions.invoke("analyze-interview", {
        body: { interviewId: id },
      });

      navigate(`/interview/${id}/report`);
    } catch {
      toast.error("Error processing results");
      navigate(`/interview/${id}/report`);
    }
  }

  function endInterview() {
    vapiRef.current?.stop();
  }

  function toggleMic() {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setMicOn(!micOn);
    }
  }

  function toggleCam() {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setCamOn(!camOn);
    }
  }

  return (
    <div className="fixed inset-0 bg-primary flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold text-primary-foreground">Mock Test Room</h1>
        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-primary-foreground/70">Connected</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {isLoading ? (
          <div className="text-center text-primary-foreground">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Connecting to interviewer...</p>
            <p className="text-sm text-primary-foreground/60 mt-2">Please allow camera and microphone access</p>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-6">
            {/* Video preview */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/80">
                  <VideoOff className="h-16 w-16 text-primary-foreground/30" />
                </div>
              )}
              {isSpeaking && (
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-white">
                    {isSpeaking === "assistant" ? "Interviewer speaking" : "You're speaking"}
                  </span>
                </div>
              )}
            </div>

            {/* Subtitles */}
            <div className="space-y-2 min-h-[80px]">
              {assistantSubtitle && (
                <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs text-primary-foreground/50 mb-1">Interviewer</p>
                  <p className="text-primary-foreground">{assistantSubtitle}</p>
                </div>
              )}
              {userSubtitle && (
                <div className="bg-sidebar-primary/20 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs text-primary-foreground/50 mb-1">You</p>
                  <p className="text-primary-foreground">{userSubtitle}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-6 border-t border-sidebar-border">
        <Button variant="outline" size="icon" className="rounded-full h-12 w-12 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20" onClick={toggleMic}>
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-400" />}
        </Button>
        <Button variant="outline" size="icon" className="rounded-full h-12 w-12 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20" onClick={toggleCam}>
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-400" />}
        </Button>
        <Button className="rounded-full h-12 px-8 bg-red-600 hover:bg-red-700 text-white font-semibold" onClick={endInterview} disabled={!isConnected}>
          <PhoneOff className="h-5 w-5 mr-2" /> End Mock Test
        </Button>
      </div>
    </div>
  );
}
