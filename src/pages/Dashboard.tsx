import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, TrendingUp, FileText, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, avgScore: 0, passRate: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("interviews")
      .select("*, interview_reports(*), countries(name, flag_emoji), visa_types(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;

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
      });
  }, [user]);

  const statCards = [
    { title: "Total Mock Tests", value: stats.total, icon: FileText, description: "All time" },
    { title: "Average Score", value: stats.avgScore, icon: Target, description: "Out of 100" },
    { title: "Pass Rate", value: `${stats.passRate}%`, icon: TrendingUp, description: "Score ≥ 60" },
  ];

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

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your mock test preparation overview</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden border-border/50 hover:border-accent/30 transition-colors">
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
        <Card className="border-border/50">
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

      {/* Recent Mock Tests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Mock Tests</h2>
        {recentInterviews.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-border/50">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-semibold text-lg">No mock tests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first mock test to get started</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentInterviews.map((interview) => (
              <Link key={interview.id} to={`/interview/${interview.id}/report`}>
                <Card className="hover:border-accent/40 hover:shadow-md transition-all cursor-pointer h-full group">
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
                        {new Date(interview.created_at).toLocaleDateString()}
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
