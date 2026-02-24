import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, TrendingUp, FileText, ArrowUpRight, Sparkles, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import ReferralModal from "@/components/referral/ReferralModal";

function ReferBanner() {
  const [referralOpen, setReferralOpen] = useState(false);
  return (
    <>
      <Card className="border-0 bg-gradient-to-r from-accent/5 to-background cursor-pointer transition-colors"
        onClick={() => setReferralOpen(true)}>
        <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <div className="flex items-start gap-4 flex-1">
            <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
              <Gift className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-sm">Refer friends & earn credits</p>
              <p className="text-xs text-muted-foreground">Earn 10 credits for each friend who signs up (up to 3 times)</p>
            </div>
          </div>
          <Button size="sm" variant="default" className="w-full sm:w-auto shrink-0 gap-1.5 border-none">
            <Gift className="h-3.5 w-3.5" /> Refer
          </Button>
        </CardContent>
      </Card>
      <ReferralModal open={referralOpen} onOpenChange={setReferralOpen} />
    </>
  );
}

export default function Dashboard({ onCreateInterview }: { onCreateInterview?: () => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, avgScore: 0, passRate: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch user profile name
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setProfileName(data.full_name);
      });

    supabase
      .from("interviews")
      .select("*, interview_reports(*), countries(name, flag_emoji), visa_types(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoading(false); return; }

        setRecentInterviews(data.slice(0, 6));

        const total = data.length;
        const scored = data.filter((i) => i.interview_reports?.overall_score != null);
        const avgScore = scored.length
          ? Math.round(scored.reduce((sum, i) => sum + (i.interview_reports?.overall_score ?? 0), 0) / scored.length)
          : 0;
        const passRate = scored.length
          ? Math.round((scored.filter((i) => (i.interview_reports?.overall_score ?? 0) >= 60).length / scored.length) * 100)
          : 0;

        setStats({ total, avgScore, passRate });

        const byDate: Record<string, number[]> = {};
        scored.forEach((i) => {
          const date = new Date(i.created_at).toLocaleDateString();
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(i.interview_reports?.overall_score ?? 0);
        });
        setChartData(
          Object.entries(byDate).map(([date, scores]) => ({
            date,
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }))
        );
        setLoading(false);
      });
  }, [user]);

  function scoreColor(score: number) {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  }

  function scoreBg(score: number) {
    if (score >= 80) return "bg-emerald-500/10";
    if (score >= 60) return "bg-amber-500/10";
    return "bg-red-500/10";
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div>
          <Skeleton className="h-9 w-48 shimmer-block" />
          <Skeleton className="h-4 w-72 mt-2 shimmer-block" />
        </div>

        {/* CTA skeleton */}
        <Skeleton className="h-28 w-full rounded-xl shimmer-block" />

        {/* Stat cards skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24 shimmer-block" />
                <Skeleton className="h-9 w-9 rounded-lg shimmer-block" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 shimmer-block" />
                <Skeleton className="h-3 w-20 mt-2 shimmer-block" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent tests skeleton */}
        <div>
          <Skeleton className="h-6 w-44 mb-4 shimmer-block" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-32 shimmer-block" />
                  <Skeleton className="h-4 w-24 mt-1 shimmer-block" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-12 shimmer-block" />
                    <Skeleton className="h-3 w-20 shimmer-block" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Total Mock Tests", value: stats.total, icon: FileText, description: "All time" },
    { title: "Average Score", value: stats.avgScore, icon: Target, description: "Out of 100" },
    { title: "Pass Rate", value: `${stats.passRate}%`, icon: TrendingUp, description: "Score ≥ 60" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Howdy {profileName || user?.email || "there"}!
        </h1>
        <p className="text-muted-foreground text-sm">Ready to ace your visa interview? Let's practice and improve your skills today.</p>
      </div>

      {/* CTA */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-accent/10 via-accent/5 to-background">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8 relative">
          <div className="h-14 w-14 rounded-2xl bg-accent/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-7 w-7 text-accent" />
          </div>
          <div className="w-full sm:flex-1">
            <h2 className="text-xl font-bold tracking-tight">Ready to ace your visa interview?</h2>
            <p className="text-sm text-muted-foreground mt-1">Practice with our AI officer and get instant, detailed feedback on your performance</p>
          </div>
          <Button size="lg" className="w-full sm:w-auto shrink-0 px-8 h-12 text-base font-semibold" onClick={onCreateInterview}>
            Start Mock Test
            <ArrowUpRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden border-0 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <card.icon className="h-4.5 w-4.5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score Trend Chart */}
      {chartData.length > 1 && (
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-accent" />
              Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(145 78% 52%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(145 78% 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(168 15% 40%)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: "hsl(168 15% 40%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 100%)",
                    border: "1px solid hsl(150 15% 90%)",
                    borderRadius: "8px",
                    fontSize: 13,
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="hsl(145 78% 52%)" strokeWidth={2.5} fill="url(#scoreGradient)" dot={{ fill: "hsl(145 78% 52%)", strokeWidth: 2, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Refer & Earn Banner */}
      <ReferBanner />

      {/* Recent Mock Tests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Mock Tests</h2>
        {recentInterviews.length === 0 ? (
          <Card className="p-12 text-center border-0">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-semibold text-lg">No mock tests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first mock test to get started</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentInterviews.map((interview) => (
              <Link key={interview.id} to={`/interview/${interview.id}/report`}>
                <Card className="transition-all cursor-pointer h-full group border-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="text-lg">{(interview.countries as any)?.flag_emoji}</span>
                          {(interview.countries as any)?.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {(interview.visa_types as any)?.name}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      {interview.interview_reports?.overall_score != null ? (
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${scoreColor(interview.interview_reports.overall_score)}`}>
                            {interview.interview_reports.overall_score}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreBg(interview.interview_reports.overall_score)} ${scoreColor(interview.interview_reports.overall_score)}`}>
                            /100
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground capitalize px-2 py-0.5 rounded-full bg-muted">{interview.status}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(interview.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
