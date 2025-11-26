"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ListLayout } from "@/components/layouts";
import { DataTable } from "@/components/data";

interface NonRespondent {
  responseId: string;
  id: string;
  name: string;
  lotNumber: string;
  address: string | null;
  token: string;
}

export default function NonRespondentsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { refreshAuth } = useAuth();
  const [nonRespondents, setNonRespondents] = useState<NonRespondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotFilter, setLotFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [addressFilter, setAddressFilter] = useState("");

  const filteredNonRespondents = nonRespondents.filter((respondent) => {
    const lotMatch =
      lotFilter === "" ||
      respondent.lotNumber.toLowerCase().includes(lotFilter.toLowerCase());
    const nameMatch =
      nameFilter === "" ||
      respondent.name.toLowerCase().includes(nameFilter.toLowerCase());
    const addressMatch =
      addressFilter === "" ||
      (respondent.address &&
        respondent.address.toLowerCase().includes(addressFilter.toLowerCase()));
    return lotMatch && nameMatch && addressMatch;
  });

  useEffect(() => {
    const fetchNonRespondents = async () => {
      try {
        const res = await fetch(`/api/surveys/${id}/nonrespondents`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setNonRespondents(data);
        } else if (res.status === 401) {
          await refreshAuth();
          router.push("/login");
        } else {
          setError("Failed to fetch nonrespondents");
        }
      } catch (err) {
        setError("Error fetching nonrespondents");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchNonRespondents();
    }
  }, [id, refreshAuth, router]);

  if (loading) {
    return (
      <ListLayout title="Nonrespondents" subtitle="Loading nonrespondents...">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ListLayout>
    );
  }

  if (error) {
    return (
      <ListLayout title="Nonrespondents" subtitle={error}>
        <div className="text-center text-red-600 dark:text-red-400 py-8">
          {error}
        </div>
      </ListLayout>
    );
  }

  return (
    <ListLayout
      title="Nonrespondents"
      actions={[
        {
          label: "Dashboard",
          onClick: () => router.push("/dashboard"),
          variant: "secondary",
        },
      ]}
    >
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Filter by Lot"
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by Name"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by Address"
          value={addressFilter}
          onChange={(e) => setAddressFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            setLotFilter("");
            setNameFilter("");
            setAddressFilter("");
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          disabled={!lotFilter && !nameFilter && !addressFilter}
        >
          Clear Filters
        </button>
      </div>
      <div className="overflow-x-auto">
        {/* Desktop Table Layout */}
        <div className="hidden md:block">
          <DataTable
            data={filteredNonRespondents}
            keyField="responseId"
            emptyMessage={nonRespondents.length === 0 ? "All members have responded to this survey." : "No nonrespondents match the current filters."}
            columns={[
              {
                key: "lotNumber",
                header: "Lot",
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: "name",
                header: "Name",
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: "address",
                header: "Address",
                render: (value) => value || "N/A",
              },
              {
                key: "actions",
                header: "Actions",
                render: (value, respondent) => (
                  <button
                    onClick={() =>
                      router.push(`/survey/${respondent.token}`)
                    }
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    Submit Response
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Mobile Card Layout */}
        <div className="block md:hidden space-y-4">
          {nonRespondents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              All members have responded to this survey.
            </div>
          ) : filteredNonRespondents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No nonrespondents match the current filters.
            </div>
          ) : (
            filteredNonRespondents.map((respondent) => (
              <div
                key={respondent.responseId}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {respondent.name}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Lot {respondent.lotNumber}
                    </div>
                    {respondent.address && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {respondent.address}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => router.push(`/survey/${respondent.token}`)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 w-full sm:w-auto"
                  >
                    Submit Response
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ListLayout>
  );
}
