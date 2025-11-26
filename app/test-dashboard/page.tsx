"use client";

import React from "react";
import { DashboardLayout } from "@/components/layouts";

export default function TestDashboardLayout() {
  const cards = [
    {
      id: "total-surveys",
      title: "Total Surveys",
      value: "24",
      subtitle: "Active surveys in the system",
      icon: "📊",
      trend: {
        value: 12,
        label: "from last month",
        isPositive: true,
      },
    },
    {
      id: "response-rate",
      title: "Response Rate",
      value: "78%",
      subtitle: "Average response rate",
      icon: "📈",
      trend: {
        value: 5,
        label: "from last month",
        isPositive: true,
      },
    },
    {
      id: "active-users",
      title: "Active Users",
      value: "156",
      subtitle: "Users who responded this month",
      icon: "👥",
      trend: {
        value: 8,
        label: "from last month",
        isPositive: true,
      },
    },
    {
      id: "pending-invites",
      title: "Pending Invites",
      value: "3",
      subtitle: "Outstanding invitations",
      icon: "📧",
      trend: {
        value: 2,
        label: "from last week",
        isPositive: false,
      },
    },
  ];

  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle="Key metrics and statistics for your HOA surveys"
      cards={cards}
    />
  );
}