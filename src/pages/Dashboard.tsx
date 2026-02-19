import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, TrendingUp, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, avgScore: 0, passRate: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch interviews with reports
    supabase
      .from("interviews")
      .select("*, interview_reports(*), countries(name), visa_types(name)")
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

        // Chart data — group by date
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
    { title: "Total Interviews", value: stats.total, icon: FileText, color: "text-primary" },
    { title: "Average Score", value: stats.avgScore, icon: Target, color: "text-accent-foreground" },
    { title: "Pass Rate", value: `${stats.passRate}%`, icon: TrendingUp, color: "text-accent-foreground" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your interview preparation overview</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score Trend Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(145 78% 52%)" strokeWidth={2} dot={{ fill: "hsl(145 78% 52%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Interviews */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Interviews</h2>
        {recentInterviews.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No interviews yet</p>
            <p className="text-sm mt-1">Create your first mock interview to get started</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentInterviews.map((interview) => (
              <Link key={interview.id} to={`/interview/${interview.id}/report`}>
                <Card className="hover:border-ring/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {(interview.countries as any)?.name} — {(interview.visa_types as any)?.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(interview.created_at).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {interview.interview_reports?.overall_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className={`text-2xl font-bold ${
                          interview.interview_reports.overall_score >= 80 ? "text-green-600" :
                          interview.interview_reports.overall_score >= 60 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {interview.interview_reports.overall_score}/100
                        </div>
                        <span className="text-sm text-muted-foreground">score</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground capitalize">{interview.status}</span>
                    )}
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
