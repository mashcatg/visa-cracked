import { useRef, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, VolumeX, Rewind, FastForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/use-mobile";

function formatTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

interface Props {
  src: string;
  className?: string;
}

export default function CustomAudioPlayer({ src, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((val: number[]) => {
    const a = audioRef.current;
    if (a) { a.currentTime = val[0]; setCurrent(val[0]); }
  }, []);

  const skip = useCallback((delta: number) => {
    const a = audioRef.current;
    if (a) { a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + delta)); }
  }, []);

  const handleVolume = useCallback((val: number[]) => {
    const a = audioRef.current;
    if (a) { a.volume = val[0]; setVolume(val[0]); setMuted(val[0] === 0); }
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const next = !muted;
    a.muted = next;
    setMuted(next);
  }, [muted]);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <audio ref={audioRef} src={src} preload="metadata" />
        
        {/* Mobile: Progress track on top */}
        {isMobile && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground font-mono w-10 text-right shrink-0">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              onValueChange={seek}
              className="flex-1 [&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent [&_.range]:bg-accent"
            />
            <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">{formatTime(duration)}</span>
          </div>
        )}
        
        {/* Controls - desktop row, mobile flex-col */}
        <div className={isMobile ? "flex gap-4" : "flex items-center gap-3"}>
          {/* Main controls */}
          <div className="flex items-center gap-3 flex-1">
            {/* Skip back */}
            <button onClick={() => skip(-10)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Rewind className="h-4 w-4" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={toggle}
              className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 transition-colors shrink-0"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            {/* Skip forward */}
            <button onClick={() => skip(10)} className="text-muted-foreground hover:text-foreground transition-colors">
              <FastForward className="h-4 w-4" />
            </button>

            {!isMobile && (
              <>
                {/* Time + Seek - Desktop only */}
                <span className="text-xs text-muted-foreground font-mono w-10 text-right shrink-0">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  max={duration || 1}
                  step={0.1}
                  onValueChange={seek}
                  className="flex-1 [&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent [&_.range]:bg-accent"
                />
                <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">{formatTime(duration)}</span>
              </>
            )}
          </div>

          {/* Volume controls - bottom row on mobile */}
          <div className={isMobile ? "flex items-center gap-3 justify-end" : "flex items-center gap-2"}>
            {/* Volume */}
            <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolume}
              className={isMobile ? "w-24 [&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent [&_.range]:bg-accent" : "w-16 shrink-0 [&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent [&_.range]:bg-accent"}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
