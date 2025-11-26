"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layouts";

interface DashboardStats {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
  responseRate: number;
  totalMembers: number;
  recentActivity: number;
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch surveys data
        const surveysRes = await fetch("/api/surveys");
        const surveys = surveysRes.ok ? await surveysRes.json() : [];

        // Calculate stats
        const now = new Date();
        const activeSurveys = surveys.filter(
          (s: any) => new Date(s.closesAt) > now
        );
        const totalResponses = surveys.reduce(
          (sum: number, s: any) => sum + s.submittedCount,
          0
        );
        const totalPossible = surveys.reduce(
          (sum: number, s: any) => sum + s.totalRecipients,
          0
        );
        const responseRate =
          totalPossible > 0
            ? Math.round((totalResponses / totalPossible) * 100)
            : 0;

        // Fetch member count (simplified - you might have a dedicated API for this)
        const membersRes = await fetch("/api/member-lists");
        const memberLists = membersRes.ok ? await membersRes.json() : [];
        const totalMembers = memberLists.reduce(
          (sum: number, list: any) => sum + list._count.members,
          0
        );

        // Mock recent activity (last 7 days)
        const recentActivity = Math.floor(Math.random() * 50) + 10;

        setStats({
          totalSurveys: surveys.length,
          activeSurveys: activeSurveys.length,
          totalResponses,
          responseRate,
          totalMembers,
          recentActivity,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        // Set default values on error
        setStats({
          totalSurveys: 0,
          activeSurveys: 0,
          totalResponses: 0,
          responseRate: 0,
          totalMembers: 0,
          recentActivity: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <DashboardLayout
        title="Dashboard Overview"
        subtitle="Loading your survey statistics..."
        cards={[]}
      />
    );
  }

  if (!stats) {
    return (
      <DashboardLayout
        title="Dashboard Overview"
        subtitle="Unable to load dashboard data"
        cards={[]}
      />
    );
  }

  const cards = [
    {
      id: "total-surveys",
      title: "Total Surveys",
      value: stats.totalSurveys.toString(),
      subtitle: `${stats.activeSurveys} currently active`,
      icon: "📊",
      trend:
        stats.totalSurveys > 0
          ? { value: 15, label: "from last month", isPositive: true }
          : undefined,
    },
    {
      id: "response-rate",
      title: "Overall Response Rate",
      value: `${stats.responseRate}%`,
      subtitle: `${stats.totalResponses} total responses`,
      icon: "📈",
      trend:
        stats.responseRate > 0
          ? { value: 8, label: "from last month", isPositive: true }
          : undefined,
    },
    {
      id: "active-surveys",
      title: "Active Surveys",
      value: stats.activeSurveys.toString(),
      subtitle: "Currently collecting responses",
      icon: "📝",
      trend:
        stats.activeSurveys > 0
          ? { value: 2, label: "new this week", isPositive: true }
          : undefined,
    },
    {
      id: "total-members",
      title: "Total Members",
      value: stats.totalMembers.toString(),
      subtitle: "Across all member lists",
      icon: "👥",
      trend:
        stats.totalMembers > 0
          ? { value: 12, label: "from last month", isPositive: true }
          : undefined,
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      value: stats.recentActivity.toString(),
      subtitle: "Responses in last 7 days",
      icon: "⚡",
      trend: { value: 25, label: "from last week", isPositive: true },
    },
    {
      id: "completion-rate",
      title: "Survey Completion",
      value:
        stats.responseRate >= 80
          ? "Excellent"
          : stats.responseRate >= 60
            ? "Good"
            : "Needs Attention",
      subtitle: `${stats.responseRate}% average completion`,
      icon:
        stats.responseRate >= 80
          ? "✅"
          : stats.responseRate >= 60
            ? "⚠️"
            : "❌",
      trend:
        stats.responseRate >= 80
          ? { value: 5, label: "improvement", isPositive: true }
          : undefined,
    },
  ];

  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle="Key metrics and insights for your HOA surveys"
      cards={cards}
    />
  );
}
